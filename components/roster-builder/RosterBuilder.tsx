"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MLB_TEAM_IDS,
  getTeamAbbreviation,
  teamLogoUrl,
  playerHeadshotUrl,
  stripDiacritics,
  type PositionUsage,
  type RosterEntry,
} from "@/lib/mlb";
import PlayerHeadshot from "@/components/shared/PlayerHeadshot";
import TeamLogo from "@/components/shared/TeamLogo";
import { FORTY_MAN_LEVEL, type ProspectPlayer } from "@/lib/prospects";
import {
  CONTRACT_SEASON,
  formatSalary,
  getContract,
  getOtherPayments,
  getTaxAdjustments,
  CONTRACTS_UPDATED,
  DEFERRAL_DISCOUNT_RATE,
  PLAYER_BENEFITS_ESTIMATE,
  PRE_ARB_BONUS_POOL_SHARE,
  MINOR_LEAGUE_SALARY,
  MINOR_LEAGUE_SALARY_FIRST_CONTRACT,
  PRE_ARB_SALARY_ESTIMATE,
  signedContract,
  flatSalaries,
  type ContractInfo,
  type Signing,
} from "@/lib/contracts";
import { FREE_AGENTS, type FreeAgent, type FreeAgentGroup } from "@/lib/free-agents";
import { useRouter } from "next/navigation";
import { ALL_TEAMS, getTeamInfo } from "@/lib/teams";
import {
  computeLuxuryTax,
  PAYOR_STATUS_LABELS,
  TAX_THRESHOLDS,
  type PayorStatus,
} from "@/lib/luxury-tax";
import { renderRosterGraphic, type GraphicRow, type GraphicPlayer } from "./rosterGraphic";

type SlotGroup = "diamond" | "bench" | "rotation" | "bullpen";

type SlotDef = {
  id: string;
  label: string;
  group: SlotGroup;
  top?: string;
  left?: string;
};

// DH has no fielding position of its own, so it sits at the bottom of the
// diamond next to home plate, below 1B.
const DIAMOND_SLOTS: SlotDef[] = [
  { id: "C", label: "C", group: "diamond", top: "90%", left: "50%" },
  { id: "DH", label: "DH", group: "diamond", top: "90%", left: "83%" },
  { id: "1B", label: "1B", group: "diamond", top: "62%", left: "83%" },
  { id: "2B", label: "2B", group: "diamond", top: "42%", left: "66%" },
  { id: "SS", label: "SS", group: "diamond", top: "42%", left: "34%" },
  { id: "3B", label: "3B", group: "diamond", top: "62%", left: "17%" },
  { id: "LF", label: "LF", group: "diamond", top: "16%", left: "18%" },
  { id: "CF", label: "CF", group: "diamond", top: "12%", left: "50%" },
  { id: "RF", label: "RF", group: "diamond", top: "16%", left: "82%" },
];

const BENCH_SLOTS: SlotDef[] = [1, 2, 3, 4].map((n) => ({ id: `BN${n}`, label: `Bench ${n}`, group: "bench" }));
const ROTATION_SLOTS: SlotDef[] = [1, 2, 3, 4, 5].map((n) => ({ id: `SP${n}`, label: `SP${n}`, group: "rotation" }));
// The last two bullpen spots are the setup man and the closer.
const BULLPEN_SLOTS: SlotDef[] = [
  ...[1, 2, 3, 4, 5, 6].map((n): SlotDef => ({ id: `RP${n}`, label: `RP${n}`, group: "bullpen" })),
  { id: "SU", label: "SU", group: "bullpen" },
  { id: "CL", label: "CL", group: "bullpen" },
];
const BULLPEN_ROLE_IDS = new Set(["SU", "CL"]);

// The 26-man roster. A two-way player used both as a hitter and a pitcher
// fills two slots but is one player, so the club gets one extra slot — on
// the bench or in the bullpen, whichever the user picks.
const TOTAL_SLOTS = DIAMOND_SLOTS.length + BENCH_SLOTS.length + ROTATION_SLOTS.length + BULLPEN_SLOTS.length;
const EXTRA_BENCH_SLOT: SlotDef = { id: "BN5", label: "Bench 5", group: "bench" };
const EXTRA_BULLPEN_SLOT: SlotDef = { id: "RP9", label: "RP7", group: "bullpen" };
type ExtraSpot = "bench" | "bullpen";
const FORTY_MAN_LIMIT = 40;
const PLAYER_ID_DRAG_TYPE = "text/plain";
// Separate type so dragging a batting-order row never drops onto a field slot.
const LINEUP_SPOT_DRAG_TYPE = "application/x-lineup-spot";

type SimplePlayer = {
  id: number;
  fullName: string;
  lastName?: string;
  position: string;
  debutDate?: string;
  bats?: string;
  throws?: string;
  level?: string;
};
type AddTab = "prospects" | "extensions" | "free-agents" | "trades" | "create";

// A player somewhere in an organization, tagged with where: "40-man", "60-day
// IL", or a minor league level.
type SystemPlayer = SimplePlayer & { level: string };
type TradePiece = SystemPlayer & { teamId: number };

const INJURED_LEVEL = "60-day IL";

type TransactionKind =
  | "trade"
  | "opt-out"
  | "signing"
  | "extension"
  | "selection"
  | "activation"
  | "option"
  | "non-tender"
  | "dfa";

// Hex colors (not CSS variables) so the roster graphic's canvas can use them.
const TRANSACTION_LABELS: Record<TransactionKind, { label: string; color: string }> = {
  trade: { label: "Trade", color: "#c41e3a" },
  signing: { label: "Signing", color: "#0f7a38" },
  extension: { label: "Extension", color: "#0f7a38" },
  "opt-out": { label: "Opted out", color: "#8a5a00" },
  selection: { label: "Contract selected", color: "#0f2a52" },
  activation: { label: "Activated", color: "#0f7a38" },
  option: { label: "Option declined", color: "#8a5a00" },
  "non-tender": { label: "Non-tender", color: "#8a5a00" },
  dfa: { label: "DFA", color: "#5b3fa0" },
};

// Money owed to a player who's no longer on the roster.
type DeadMoney = {
  player: SimplePlayer;
  reason: "designated for assignment" | "option buyout";
  amount: number;
  // Luxury-tax hit (a DFA'd deal still counts at its AAV).
  taxAmount: number;
  salaryBySeason?: Record<number, number>;
  detail: string;
};

type Transaction = {
  id: number;
  kind: TransactionKind;
  summary: string;
  detail?: string;
  // What the move changed, so it can be undone: players it put on and took
  // off the 40-man, and each touched player's builder contract beforehand
  // (null = none).
  incoming: SimplePlayer[];
  outgoing: SimplePlayer[];
  signingsBefore: Record<number, Signing | null>;
  // Trades can also move players who aren't on the 40-man.
  outgoingInjured?: SimplePlayer[];
  outgoingProspects?: SystemPlayer[];
  // Cash in a trade, for CONTRACT_SEASON: positive is sent to the partner,
  // negative received from them.
  cash?: number;
  partnerTeamId?: number;
  incomingProspects?: SystemPlayer[];
  // Activations: players who came off the 60-day IL onto the 40-man.
  fromIL?: SimplePlayer[];
};

const LINEUP_SPOTS = 9;

// Seasons after CONTRACT_SEASON shown as future payroll commitments.
const FUTURE_COMMITMENT_SEASONS = 4;
type FreeAgentFilter = "all" | FreeAgentGroup;

const FREE_AGENT_FILTERS: FreeAgentFilter[] = ["all", "C", "1B", "2B", "SS", "3B", "LF", "CF", "RF", "DH", "SP", "RP"];
const MAX_CONTRACT_YEARS = 15;

const HANDS = ["L", "R", "S"];

const CREATE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

const CONTRACT_STATUS_LABELS: Record<ContractInfo["status"], string> = {
  guaranteed: "Signed",
  signed: "New deal",
  extended: "Extended",
  "club-option": "Club option",
  "mutual-option": "Mutual option",
  "vesting-option": "Vesting option",
  "player-option": "Player option",
  arbitration: "Arbitration",
  "pre-arb": "Pre-arb",
};

// Prefer the API's display last name ("Scott II", "De La Cruz"); the
// last-word fallback only covers players without one.
function displayLastName(player: SimplePlayer) {
  if (player.lastName) {
    return player.lastName;
  }

  const parts = player.fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// Player lists are alphabetical by last name ("De La Cruz" under D).
function compareByLastName(a: SimplePlayer, b: SimplePlayer) {
  return (
    displayLastName(a).localeCompare(displayLastName(b), undefined, { sensitivity: "base" }) ||
    a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })
  );
}

function sortByLastName<T extends SimplePlayer>(players: T[]): T[] {
  return [...players].sort(compareByLastName);
}

// Trade lists keep an organization's groups in the order they arrive —
// 40-man first, then the 60-day IL, then each minor league level — and sort
// by last name within each group.
function sortWithinLevels<T extends SystemPlayer>(players: T[]): T[] {
  const levelRank = new Map<string, number>();
  for (const player of players) {
    if (!levelRank.has(player.level)) {
      levelRank.set(player.level, levelRank.size);
    }
  }
  return [...players].sort(
    (a, b) => (levelRank.get(a.level) ?? 0) - (levelRank.get(b.level) ?? 0) || compareByLastName(a, b)
  );
}

// How well a player fits an open roster spot, from last season's usage:
// games at that position, starts for the rotation, relief outings for the
// bullpen, holds for setup, saves for the closer, and total games for the
// bench. Players without MLB stats fall back to their listed position.
function slotFit(player: SimplePlayer, slot: SlotDef, usage: PositionUsage | undefined): number {
  if (slot.group === "diamond") {
    return (usage?.games[slot.id] ?? 0) + (player.position === slot.id ? 0.5 : 0);
  }
  if (slot.group === "bench") {
    return Object.values(usage?.games ?? {}).reduce((sum, count) => sum + count, 0);
  }
  if (slot.group === "rotation") {
    return usage?.starts ?? 0;
  }

  const relief = usage?.relief ?? 0;
  if (slot.id === "CL") {
    return (usage?.saves ?? 0) * 1000 + relief;
  }
  if (slot.id === "SU") {
    return (usage?.holds ?? 0) * 1000 + relief;
  }
  return relief;
}

const HAND_NAMES: Record<string, string> = { L: "left", R: "right", S: "switch" };

type Handed = { fullName: string; position: string; bats?: string; throws?: string };

// Pitchers are labeled by throwing hand ("RHP"); everyone else by position.
function positionLabel(player: Handed) {
  if (player.position === "P") {
    if (player.throws === "S") {
      return "Switch P";
    }
    return player.throws ? `${player.throws}HP` : "P";
  }

  return player.position;
}

// "Alec Burleson (L)": a hitter's batting side follows the name in a lighter
// color. A pitcher's hand is usually in their position label ("RHP")
// instead; `showThrows` puts it after the name for lists that don't use one.
function PlayerName({ player, showThrows = false }: { player: Handed; showThrows?: boolean }) {
  const hand = player.position === "P" ? (showThrows ? player.throws : undefined) : player.bats;

  return (
    <>
      {player.fullName}
      {hand && (
        <span style={{ color: "var(--muted)", fontWeight: 400 }} title={handTitle(player)}>
          {" "}
          ({hand})
        </span>
      )}
    </>
  );
}

function handTitle(player: { position: string; bats?: string; throws?: string }) {
  if (player.position === "P") {
    return player.throws ? `Throws ${HAND_NAMES[player.throws] ?? player.throws}` : undefined;
  }

  return player.bats ? `Bats ${HAND_NAMES[player.bats] ?? player.bats}` : undefined;
}

// What dropping a player from the 40-man means for their contract.
function removalKind(contract: ContractInfo | null): "option" | "opt-out" | "non-tender" | "dfa" {
  // A player option or pending opt-out is the player's call: removing him
  // means he opted out.
  if (contract?.status === "player-option") {
    return "opt-out";
  }

  if (contract?.status === "club-option" || contract?.status === "mutual-option" || contract?.status === "vesting-option") {
    return "option";
  }

  if (contract?.status === "arbitration" || contract?.status === "pre-arb") {
    return "non-tender";
  }

  return "dfa";
}

const REMOVAL_ACTIONS: Record<"option" | "opt-out" | "non-tender" | "dfa", string> = {
  option: "Decline option",
  "opt-out": "Player opts out",
  "non-tender": "Non-tender",
  dfa: "Designate for assignment",
};

// Tooltip for the 40-man remove button, with the buyout a declined option
// still costs.
function removalTitle(contract: ContractInfo | null) {
  const action = REMOVAL_ACTIONS[removalKind(contract)];
  return contract?.buyout ? `${action} (${formatSalary(contract.buyout)} buyout)` : action;
}

function parseMillions(text: string): number | null {
  const millions = Number(text);
  return text.trim() && Number.isFinite(millions) && millions > 0 ? Math.round(millions * 1_000_000) : null;
}

function parseYears(text: string): number | null {
  const years = Number(text);
  return Number.isInteger(years) && years >= 1 && years <= MAX_CONTRACT_YEARS ? years : null;
}

type StructureChoice = "flat" | "custom";

const STRUCTURE_LABELS: Record<StructureChoice, string> = {
  flat: "Flat",
  custom: "Custom by year",
};

function formatFreeAgentAfter(contract: ContractInfo | null) {
  if (!contract?.freeAgentAfter) {
    return "—";
  }

  return contract.freeAgentEstimated ? `${contract.freeAgentAfter}+ est.` : String(contract.freeAgentAfter);
}

const contractFieldStyle: React.CSSProperties = {
  padding: "0.35rem 0.6rem",
  borderRadius: "999px",
  border: "1px solid var(--line)",
  background: "var(--bg-soft)",
  color: "var(--text)",
  fontSize: "0.8rem",
};

const smallButtonStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--text)",
  fontWeight: 700,
  borderRadius: "999px",
  padding: "0.35rem 0.8rem",
  cursor: "pointer",
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
};

// Total value ($M) + years, used to sign a free agent, extend a player, or
// set a contract on a created player. A multi-year deal is flat (the total
// split evenly) unless it's set season by season with "Custom by year", in
// which case the seasons add up to the total. Any deal can defer part of
// its money; an extension can start now (replacing the current deal) or
// the season after it ends (`startOptions`).
function SignForm({
  submitLabel,
  initial,
  startOptions,
  disabled = false,
  onSign,
}: {
  submitLabel: string;
  initial?: Signing;
  startOptions?: number[];
  // Blocks submitting even with a valid deal (e.g. a created player
  // without a name yet).
  disabled?: boolean;
  onSign: (signing: Signing) => void;
}) {
  const initialTotal = initial ? initial.salaries.reduce((sum, salary) => sum + salary, 0) : 0;
  const initialFlat = initial ? flatSalaries(initialTotal, initial.salaries.length).every((salary, index) => salary === initial.salaries[index]) : true;

  const [total, setTotal] = useState(initial ? String(initialTotal / 1_000_000) : "");
  const [years, setYears] = useState(initial ? String(initial.salaries.length) : "1");
  const [structure, setStructure] = useState<StructureChoice>(initialFlat ? "flat" : "custom");
  const [customSalaries, setCustomSalaries] = useState<string[]>(
    initial && !initialFlat ? initial.salaries.map((amount) => String(amount / 1_000_000)) : []
  );
  const [startSeason, setStartSeason] = useState(initial?.startSeason ?? startOptions?.[0] ?? CONTRACT_SEASON);
  const [deferOpen, setDeferOpen] = useState(!!initial?.deferral);
  const [deferTotal, setDeferTotal] = useState(initial?.deferral ? String(initial.deferral.total / 1_000_000) : "");
  const [payoutStart, setPayoutStart] = useState(initial?.deferral ? String(initial.deferral.payoutStart) : "");
  const [payoutYears, setPayoutYears] = useState(initial?.deferral ? String(initial.deferral.payoutYears) : "10");

  const yearCount = parseYears(years);
  const isCustom = structure === "custom" && yearCount !== null && yearCount > 1;

  let salaries: number[] | null = null;
  if (yearCount !== null) {
    if (isCustom) {
      const perSeason = Array.from({ length: yearCount }, (_, index) => parseMillions(customSalaries[index] ?? ""));
      salaries = perSeason.every((amount): amount is number => amount !== null) ? perSeason : null;
    } else {
      const totalAmount = parseMillions(total);
      salaries = totalAmount !== null ? flatSalaries(totalAmount, yearCount) : null;
    }
  }

  const dealTotal = salaries ? salaries.reduce((sum, amount) => sum + amount, 0) : null;
  const customTotal = isCustom ? dealTotal : null;
  const lastSeason = startSeason + (yearCount ?? 1) - 1;

  // Deferred money is optional; once any of it is entered it has to be a
  // usable schedule: no more than the deal is worth, paid out after the
  // deal starts.
  const deferAmount = deferOpen ? parseMillions(deferTotal) : null;
  const payoutFrom = Number(payoutStart || lastSeason + 1);
  const payoutCount = parseYears(payoutYears);
  const deferEntered = deferOpen && deferTotal.trim() !== "";
  const deferralValid =
    !deferEntered ||
    (deferAmount !== null &&
      dealTotal !== null &&
      deferAmount <= dealTotal &&
      payoutCount !== null &&
      Number.isInteger(payoutFrom) &&
      payoutFrom > startSeason);
  const deferral =
    deferEntered && deferralValid && deferAmount !== null && payoutCount !== null
      ? { total: deferAmount, payoutStart: payoutFrom, payoutYears: payoutCount }
      : undefined;
  const ready = !!salaries && deferralValid && !disabled;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (salaries && ready) {
          onSign({
            salaries,
            ...(startSeason !== CONTRACT_SEASON ? { startSeason } : {}),
            ...(deferral ? { deferral } : {}),
          });
        }
      }}
      style={{ display: "grid", gap: "0.35rem", justifyItems: "end" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {startOptions && startOptions.length > 1 && (
          <select
            value={startSeason}
            onChange={(event) => setStartSeason(Number(event.target.value))}
            aria-label="Extension starts"
            title="When the new deal starts"
            style={{ ...contractFieldStyle, width: "auto" }}
          >
            {startOptions.map((season) => (
              <option key={season} value={season}>
                {season === CONTRACT_SEASON ? `Starts ${season} (replaces deal)` : `Starts ${season}`}
              </option>
            ))}
          </select>
        )}
        {isCustom ? (
          <span style={{ fontSize: "0.8rem", fontWeight: 700, minWidth: "6.5rem", textAlign: "right" }}>
            {customTotal !== null ? `${formatSalary(customTotal)} total` : "Fill every season"}
          </span>
        ) : (
          <input
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder="Total $M"
            aria-label="Total contract value in millions"
            style={{ ...contractFieldStyle, width: "6.5rem" }}
          />
        )}
        <input
          type="number"
          min="1"
          max={MAX_CONTRACT_YEARS}
          step="1"
          inputMode="numeric"
          value={years}
          onChange={(event) => setYears(event.target.value)}
          aria-label="Contract years"
          style={{ ...contractFieldStyle, width: "4rem" }}
        />
        <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>yr</span>
        {yearCount !== null && yearCount > 1 && (
          <select
            value={structure}
            onChange={(event) => {
              const next = event.target.value as StructureChoice;
              // Start the season boxes from the flat split of whatever total
              // was entered.
              const totalAmount = parseMillions(total);
              if (next === "custom" && totalAmount !== null && customSalaries.length === 0) {
                setCustomSalaries(flatSalaries(totalAmount, yearCount).map((amount) => String(amount / 1_000_000)));
              }
              setStructure(next);
            }}
            aria-label="Salary structure (optional)"
            title="Salary structure (optional)"
            style={{ ...contractFieldStyle, width: "auto" }}
          >
            {(Object.keys(STRUCTURE_LABELS) as StructureChoice[]).map((choice) => (
              <option key={choice} value={choice}>
                {STRUCTURE_LABELS[choice]}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setDeferOpen((open) => !open)}
          aria-expanded={deferOpen}
          title="Defer part of the money (optional)"
          style={{
            ...smallButtonStyle,
            background: deferOpen ? "rgba(15,42,82,0.1)" : "var(--panel)",
          }}
        >
          Defer
        </button>
        <button type="submit" disabled={!ready} style={{ ...smallButtonStyle, opacity: ready ? 1 : 0.5 }}>
          {submitLabel}
        </button>
      </div>

      {isCustom && yearCount !== null && (
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {Array.from({ length: yearCount }, (_, index) => (
            <label key={index} style={{ display: "grid", gap: "0.1rem", fontSize: "0.68rem", color: "var(--muted)" }}>
              {startSeason + index}
              <input
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={customSalaries[index] ?? ""}
                onChange={(event) =>
                  setCustomSalaries((current) => {
                    const next = [...current];
                    next[index] = event.target.value;
                    return next;
                  })
                }
                placeholder="$M"
                aria-label={`${startSeason + index} salary in millions`}
                style={{ ...contractFieldStyle, width: "4.6rem" }}
              />
            </label>
          ))}
        </div>
      )}

      {deferOpen && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <input
            type="number"
            min="0"
            step="0.1"
            inputMode="decimal"
            value={deferTotal}
            onChange={(event) => setDeferTotal(event.target.value)}
            placeholder="Deferred $M"
            aria-label="Total deferred in millions"
            style={{ ...contractFieldStyle, width: "6.5rem" }}
          />
          <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>paid from</span>
          <input
            type="number"
            min={startSeason + 1}
            step="1"
            inputMode="numeric"
            value={payoutStart}
            onChange={(event) => setPayoutStart(event.target.value)}
            placeholder={String(lastSeason + 1)}
            aria-label="First deferred payout season"
            style={{ ...contractFieldStyle, width: "5rem" }}
          />
          <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>over</span>
          <input
            type="number"
            min="1"
            max={MAX_CONTRACT_YEARS}
            step="1"
            inputMode="numeric"
            value={payoutYears}
            onChange={(event) => setPayoutYears(event.target.value)}
            aria-label="Deferred payout years"
            style={{ ...contractFieldStyle, width: "4rem" }}
          />
          <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>yr</span>
          {deferEntered && !deferralValid && (
            <span style={{ width: "100%", textAlign: "right", fontSize: "0.72rem", color: "#b42318" }}>
              Deferred money can&apos;t exceed the deal, and payouts have to start after {startSeason}.
            </span>
          )}
        </div>
      )}
    </form>
  );
}

function isPitcherSlot(group: SlotGroup) {
  return group === "rotation" || group === "bullpen";
}

const SLOT_GROUPS = new Map(
  [...DIAMOND_SLOTS, ...BENCH_SLOTS, ...ROTATION_SLOTS, ...BULLPEN_SLOTS, EXTRA_BENCH_SLOT, EXTRA_BULLPEN_SLOT].map(
    (slot) => [slot.id, slot.group]
  )
);

function slotGroupById(slotId: string): SlotGroup | null {
  return SLOT_GROUPS.get(slotId) ?? null;
}

// Two-way players (MLB's "TWP", e.g. Shohei Ohtani) can fill a hitter slot
// and a pitcher slot at the same time.
function isTwoWay(player: { position: string }) {
  return player.position === "TWP";
}

function canFillSlot(player: { position: string }, group: SlotGroup) {
  return isTwoWay(player) || (player.position === "P") === isPitcherSlot(group);
}

// Shown on a filled slot: a two-way player pitching is labeled by hand.
function slotPositionLabel(player: Handed, group: SlotGroup) {
  return isTwoWay(player) && isPitcherSlot(group) && player.throws ? `${player.throws}HP` : positionLabel(player);
}

const slotButtonBase: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.15rem",
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--text)",
  cursor: "pointer",
  textAlign: "center",
  padding: "0.3rem",
};

function SlotCell({
  slot,
  player,
  isOpen,
  onToggleOpen,
  onDrop,
  onDragStart,
  onClear,
  query,
  onQueryChange,
  eligiblePlayers,
  onSelect,
}: {
  slot: SlotDef;
  player: SimplePlayer | null;
  isOpen: boolean;
  onToggleOpen: (slot: SlotDef) => void;
  onDrop: (slot: SlotDef, event: React.DragEvent) => void;
  onDragStart: (event: React.DragEvent, playerId: number) => void;
  onClear: (slot: SlotDef) => void;
  query: string;
  onQueryChange: (value: string) => void;
  eligiblePlayers: SimplePlayer[];
  onSelect: (slot: SlotDef, player: SimplePlayer) => void;
}) {
  const isDiamond = slot.group === "diamond";

  const wrapperStyle: React.CSSProperties = isDiamond
    ? {
        position: "absolute",
        top: slot.top,
        left: slot.left,
        transform: "translate(-50%, -50%)",
        zIndex: isOpen ? 20 : 1,
      }
    : {
        position: "relative",
        width: "100%",
        zIndex: isOpen ? 20 : 1,
      };

  const buttonStyle: React.CSSProperties = {
    ...slotButtonBase,
    ...(isDiamond
      ? { width: "58px", height: "58px", borderRadius: "50%" }
      : { width: "100%", minHeight: "56px", borderRadius: "12px" }),
    border: isOpen ? "2px solid var(--accent)" : "1px solid var(--line)",
    background: player ? "rgba(196,30,58,0.08)" : "var(--panel)",
  };

  return (
    <div style={wrapperStyle}>
      <button
        type="button"
        draggable={!!player}
        onDragStart={(event) => player && onDragStart(event, player.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onDrop(slot, event)}
        onClick={() => (player ? onClear(slot) : onToggleOpen(slot))}
        title={player ? "Drag to move, click to clear" : "Click or drag a player here"}
        style={buttonStyle}
      >
        <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
          {slot.label}
        </span>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, lineHeight: 1.1 }}>
          {player ? displayLastName(player) : "+"}
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "0.4rem",
            width: "230px",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            background: "var(--panel)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            padding: "0.6rem",
            display: "grid",
            gap: "0.4rem",
          }}
        >
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search 40-man roster..."
            style={{
              width: "100%",
              padding: "0.45rem 0.7rem",
              borderRadius: "999px",
              border: "1px solid var(--line)",
              background: "var(--bg-soft)",
              color: "var(--text)",
              fontSize: "0.8rem",
            }}
          />
          <div style={{ display: "grid", gap: "0.3rem", maxHeight: "220px", overflowY: "auto" }}>
            {eligiblePlayers.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.8rem" }}>No eligible players.</p>
            ) : (
              eligiblePlayers.map((eligible) => (
                <button
                  key={eligible.id}
                  type="button"
                  onClick={() => onSelect(slot, eligible)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.35rem 0.5rem",
                    borderRadius: "10px",
                    border: "1px solid var(--line)",
                    background: "rgba(15,31,61,0.02)",
                    color: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "0.8rem",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    <PlayerName player={eligible} />
                  </span>
                  <span style={{ color: "var(--muted)", marginLeft: "auto", whiteSpace: "nowrap" }} title={handTitle(eligible)}>
                    {positionLabel(eligible)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const removeChipButtonStyle: React.CSSProperties = {
  width: "1.2rem",
  height: "1.2rem",
  borderRadius: "50%",
  border: "none",
  background: "rgba(180,35,24,0.12)",
  color: "#b42318",
  fontWeight: 800,
  cursor: "pointer",
  lineHeight: 1,
};

// A player already in the trade, on either side.
function TradeChip({
  player,
  meta,
  removeLabel,
  onRemove,
}: {
  player: SimplePlayer;
  meta: (string | null | undefined)[];
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.25rem 0.3rem 0.25rem 0.65rem",
        borderRadius: "999px",
        border: "1px solid var(--line)",
        background: "var(--panel)",
        fontSize: "0.82rem",
        fontWeight: 700,
      }}
    >
      <PlayerName player={player} />
      <span style={{ color: "var(--muted)", fontWeight: 400 }}>{meta.filter(Boolean).join(" · ")}</span>
      <button type="button" onClick={onRemove} aria-label={removeLabel} style={removeChipButtonStyle}>
        ×
      </button>
    </span>
  );
}

// A searchable player who can be added to one side of the trade.
// "Add", or why the player can't be added: already in the trade, or already
// in the organization (acquired in an earlier trade).
function TradeResultRow({
  player,
  blockedLabel,
  onAdd,
}: {
  player: SystemPlayer;
  blockedLabel?: string;
  onAdd: () => void;
}) {
  const blocked = !!blockedLabel;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.55rem",
        padding: "0.4rem 0.6rem",
        borderRadius: "12px",
        border: "1px solid var(--line)",
        background: "var(--panel)",
      }}
    >
      <div
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "rgba(15,31,61,.08)",
          border: "1px solid var(--line)",
        }}
      >
        <PlayerHeadshot
          src={playerHeadshotUrl(player.id, 60)}
          alt={player.fullName}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
        />
      </div>
      <span style={{ display: "grid", minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: "0.86rem" }}>
          <PlayerName player={player} />
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.74rem" }} title={handTitle(player)}>
          {positionLabel(player)} · {player.level}
        </span>
      </span>
      <button
        type="button"
        onClick={onAdd}
        disabled={blocked}
        style={{ ...smallButtonStyle, marginLeft: "auto", opacity: blocked ? 0.5 : 1, cursor: blocked ? "default" : "pointer" }}
      >
        {blockedLabel ?? "Add"}
      </button>
    </div>
  );
}

export default function RosterBuilder({
  teamId,
  roster,
  prospects,
  sixtyDayIL,
  departingFreeAgents = [],
  positionUsage = {},
}: {
  teamId: number;
  roster: RosterEntry[];
  prospects: ProspectPlayer[];
  sixtyDayIL: RosterEntry[];
  // Names of players left off because their contracts are up.
  departingFreeAgents?: string[];
  // Last season's usage by player id (see slotFit).
  positionUsage?: Record<number, PositionUsage>;
}) {
  const router = useRouter();
  const team = getTeamInfo(teamId);
  const teamAbbreviation = getTeamAbbreviation(teamId);
  // Trade partners: every other club.
  const partnerTeamIds = useMemo(
    () =>
      MLB_TEAM_IDS.filter((id) => id !== teamId).sort((a, b) =>
        getTeamAbbreviation(a).localeCompare(getTeamAbbreviation(b))
      ),
    [teamId]
  );
  const [fortyMan, setFortyMan] = useState<SimplePlayer[]>(roster);
  const [reserveIL, setReserveIL] = useState<SimplePlayer[]>(sixtyDayIL);
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  const [positionView, setPositionView] = useState<"defense" | "lineup">("defense");
  // The user's batting-order adjustments (player ids, top to bottom). The
  // lineup itself is generated from the defense — see `lineup` below.
  const [battingOrder, setBattingOrder] = useState<number[]>([]);
  const [addTab, setAddTab] = useState<AddTab>("prospects");
  const [addQuery, setAddQuery] = useState("");
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [slotQuery, setSlotQuery] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createPosition, setCreatePosition] = useState(CREATE_POSITIONS[0]);
  const [createBats, setCreateBats] = useState("R");
  const [createThrows, setCreateThrows] = useState("R");
  const [freeAgentFilter, setFreeAgentFilter] = useState<FreeAgentFilter>("all");
  // Deals made in the builder, keyed by player id. These override any
  // real contract data for that player.
  const [signings, setSignings] = useState<Record<number, Signing>>({});
  const [payrollOpen, setPayrollOpen] = useState(false);
  // Starts with this club's players; trade partners' 40-man usage is added
  // as their systems load.
  const [usageById, setUsageById] = useState<Record<number, PositionUsage>>(positionUsage);
  const [payorStatus, setPayorStatus] = useState<PayorStatus>("first");
  // Where the extra slot goes while a two-way player is both hitting and
  // pitching.
  const [extraSpot, setExtraSpot] = useState<ExtraSpot>("bullpen");
  // The club's minor leaguers — starts as the real system and changes with
  // trades.
  const [systemProspects, setSystemProspects] = useState<SystemPlayer[]>(prospects);
  // Trade builder: which club is being browsed, each club's system once
  // loaded, and the players coming back.
  const [tradeTeamId, setTradeTeamId] = useState<number | null>(null);
  const [orgPlayers, setOrgPlayers] = useState<Record<number, TradePiece[] | "loading" | "error">>({});
  const [tradeIncoming, setTradeIncoming] = useState<TradePiece[]>([]);
  const [tradeOutgoingIds, setTradeOutgoingIds] = useState<number[]>([]);
  const [tradeQuery, setTradeQuery] = useState("");
  // Cash each side adds to the trade, in $M.
  const [tradeCashOut, setTradeCashOut] = useState("");
  const [tradeCashIn, setTradeCashIn] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const nextTransactionId = useRef(1);
  // Created players get negative ids so they can never collide with a
  // real MLB player id.
  const nextCreatedId = useRef(-1);

  // Real contracts for every club's players (lib/contracts-data.json), so a
  // player acquired in a trade brings their actual salary with them.
  const contractFor = useCallback(
    (player: SimplePlayer) => {
      const signing = signings[player.id];
      // An extension that starts later builds on the current contract.
      return signing ? signedContract(signing, getContract(player)) : getContract(player);
    },
    [signings]
  );

  // Money still owed to players the builder has dropped: guaranteed deals
  // (real multi-year contracts and builder signings) of players designated
  // for assignment, and the buyouts of declined options.
  const deadMoney = useMemo(
    () =>
      transactions.flatMap((transaction) =>
        transaction.outgoing.flatMap((player): DeadMoney[] => {
          const contract = contractFor(player);
          if (
            transaction.kind === "dfa" &&
            (contract?.status === "guaranteed" || contract?.status === "signed" || contract?.status === "extended")
          ) {
            return [
              {
                player,
                reason: "designated for assignment",
                amount: contract.salary,
                taxAmount: contract.cbt ?? contract.salary,
                salaryBySeason: contract.salaryBySeason,
                detail: contract.detail,
              },
            ];
          }
          if ((transaction.kind === "option" || transaction.kind === "opt-out") && contract?.buyout) {
            return [
              {
                player,
                reason: "option buyout",
                amount: contract.buyout,
                taxAmount: contract.buyout,
                detail: contract.detail,
              },
            ];
          }
          return [];
        })
      ),
    [transactions, contractFor]
  );


  const fortyManIds = useMemo(() => new Set(fortyMan.map((player) => player.id)), [fortyMan]);
  const fortyManById = useMemo(() => new Map(fortyMan.map((player) => [player.id, player])), [fortyMan]);

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter((id): id is number => id !== null && id !== undefined)),
    [assignments]
  );

  // Which side(s) each assigned player is on.
  const assignedSides = useMemo(() => {
    const sides = new Map<number, { hitting: boolean; pitching: boolean }>();
    for (const [slotId, playerId] of Object.entries(assignments)) {
      if (playerId == null) {
        continue;
      }
      const group = slotGroupById(slotId);
      const side = sides.get(playerId) ?? { hitting: false, pitching: false };
      if (group && isPitcherSlot(group)) {
        side.pitching = true;
      } else if (group) {
        side.hitting = true;
      }
      sides.set(playerId, side);
    }
    return sides;
  }, [assignments]);

  // A two-way player on both sides opens the extra slot.
  const twoWayPlayer = fortyMan.find((player) => {
    const side = assignedSides.get(player.id);
    return isTwoWay(player) && side?.hitting && side?.pitching;
  });
  const extraSlot = twoWayPlayer ? (extraSpot === "bench" ? EXTRA_BENCH_SLOT : EXTRA_BULLPEN_SLOT) : null;
  const benchSlots = extraSlot?.group === "bench" ? [...BENCH_SLOTS, extraSlot] : BENCH_SLOTS;
  // An extra reliever slots in ahead of the setup man and closer.
  const bullpenSlots =
    extraSlot?.group === "bullpen"
      ? [...BULLPEN_SLOTS.filter((slot) => !BULLPEN_ROLE_IDS.has(slot.id)), extraSlot, ...BULLPEN_SLOTS.filter((slot) => BULLPEN_ROLE_IDS.has(slot.id))]
      : BULLPEN_SLOTS;
  const allSlots = [...DIAMOND_SLOTS, ...benchSlots, ...ROTATION_SLOTS, ...bullpenSlots];

  // Counts players, not slots (a two-way player in two slots is one spot),
  // and only slots that currently exist — an extra slot that just closed is
  // cleared by the effect below, but shouldn't count even for that render.
  const filledCount = new Set(
    allSlots.map((slot) => assignments[slot.id]).filter((id): id is number => id != null)
  ).size;

  // Whoever's in an extra slot that's gone (the two-way player left one
  // side, or the extra spot moved) comes off it.
  useEffect(() => {
    const stale = [EXTRA_BENCH_SLOT, EXTRA_BULLPEN_SLOT].filter((slot) => slot.id !== extraSlot?.id);
    if (stale.some((slot) => assignments[slot.id] != null)) {
      setAssignments((current) => {
        const next = { ...current };
        for (const slot of stale) {
          next[slot.id] = null;
        }
        return next;
      });
    }
  }, [extraSlot?.id, assignments]);

  // Everyone on the 40-man or the 60-day IL is paid — but a pre-arb player
  // who isn't on the 26-man is in the minors on a split contract, paid the
  // minor league 40-man salary instead. Non-tendered players
  // and declined options cost nothing; DFA'd guaranteed deals are dead money,
  // on top of what the club already owes players it's moved on from
  // (cash sent in trades, releases, buyouts).
  const payroll = useMemo(() => {
    const otherPayments = getOtherPayments(teamId);
    const currentOtherPayments = otherPayments.filter((payment) => payment.season === CONTRACT_SEASON);
    // The projected 26-man: everyone in a slot, then — while spots are still
    // open — the unslotted 40-man players most likely to fill them: those on
    // real big-league deals first, then pre-arb players by MLB debut.
    const slottedIds = new Set(
      allSlots.map((slot) => assignments[slot.id]).filter((id): id is number => id != null)
    );
    const openSpots = Math.max(0, TOTAL_SLOTS - slottedIds.size);
    const isPreArb = (player: SimplePlayer) => contractFor(player)?.status === "pre-arb";
    const projectedActive = new Set(slottedIds);
    fortyMan
      .filter((player) => !slottedIds.has(player.id))
      .sort((a, b) => {
        if (isPreArb(a) !== isPreArb(b)) {
          return isPreArb(a) ? 1 : -1;
        }
        return (a.debutDate ?? "9999").localeCompare(b.debutDate ?? "9999");
      })
      .slice(0, openSpots)
      .forEach((player) => projectedActive.add(player.id));

    // Anyone on a 40-man before this offseason (the club's own or acquired
    // from another's) is on at least their second major league contract;
    // players newly added (selected) are on their first.
    const priorFortyManIds = new Set([
      ...roster.map((player) => player.id),
      ...sixtyDayIL.map((player) => player.id),
      ...transactions.filter((transaction) => transaction.kind === "trade").flatMap((transaction) => transaction.incoming.map((player) => player.id)),
    ]);
    const onFortyMan = new Set(fortyMan.map((player) => player.id));

    const rows = [...fortyMan, ...reserveIL]
      .map((player) => {
        const contract = contractFor(player);
        const inMinors = onFortyMan.has(player.id) && contract?.status === "pre-arb" && !projectedActive.has(player.id);
        const minorSalary = priorFortyManIds.has(player.id) ? MINOR_LEAGUE_SALARY : MINOR_LEAGUE_SALARY_FIRST_CONTRACT;
        return { player, contract, inMinors, salary: inMinors ? minorSalary : contract?.salary ?? 0 };
      })
      .sort((a, b) => (b.contract ? b.salary : -1) - (a.contract ? a.salary : -1));

    const totals = { guaranteed: 0, arbitration: 0, preArb: 0, deadMoney: 0, unknownCount: 0 };

    for (const { contract, salary } of rows) {
      if (!contract) {
        totals.unknownCount += 1;
      } else if (contract.status === "arbitration") {
        totals.arbitration += salary;
      } else if (contract.status === "pre-arb") {
        totals.preArb += salary;
      } else {
        totals.guaranteed += salary;
      }
    }
    const minorsCount = rows.filter((row) => row.inMinors).length;

    for (const entry of deadMoney) {
      totals.deadMoney += entry.amount;
    }
    for (const payment of currentOtherPayments) {
      totals.deadMoney += payment.amount;
    }
    // Cash sent in builder trades is owed this season; cash received offsets.
    const tradeCash = transactions
      .filter((transaction) => transaction.kind === "trade" && transaction.cash)
      .map((transaction) => ({
        id: transaction.id,
        amount: transaction.cash ?? 0,
        description: `Cash ${(transaction.cash ?? 0) > 0 ? "to" : "from"} ${
          transaction.partnerTeamId ? getTeamAbbreviation(transaction.partnerTeamId) : "trade partner"
        } (trade)`,
      }));
    for (const entry of tradeCash) {
      totals.deadMoney += entry.amount;
    }

    const total = totals.guaranteed + totals.arbitration + totals.preArb + totals.deadMoney;

    // Later seasons only count money that's actually guaranteed (real
    // multi-year deals and builder signings, including dead money) —
    // arbitration and pre-arb salaries past next season aren't projected.
    const future = Array.from({ length: FUTURE_COMMITMENT_SEASONS }, (_, index) => {
      const season = CONTRACT_SEASON + 1 + index;
      const committed =
        rows.reduce((sum, { contract }) => sum + (contract?.salaryBySeason?.[season] ?? 0), 0) +
        deadMoney.reduce((sum, entry) => sum + (entry.salaryBySeason?.[season] ?? 0), 0) +
        otherPayments.filter((payment) => payment.season === season).reduce((sum, payment) => sum + payment.amount, 0);
      return { season, committed };
    });

    // Part of this season's salaries paid in later years (real deferrals
    // FanGraphs spells out, and builder deals).
    const deferred = rows.reduce((sum, { contract }) => sum + (contract?.deferred ?? 0), 0);

    // Luxury-tax payroll: each contract at its tax hit (a guaranteed deal's
    // AAV, deferred money at present value), money owed to former players,
    // FanGraphs' tax-only adjustments, and player benefits.
    const taxAdjustments = getTaxAdjustments(teamId);
    const taxPayroll =
      rows.reduce((sum, { contract, salary, inMinors }) => sum + (contract ? (inMinors ? salary : contract.cbt ?? salary) : 0), 0) +
      deadMoney.reduce((sum, entry) => sum + entry.taxAmount, 0) +
      currentOtherPayments.reduce((sum, payment) => sum + payment.amount, 0) +
      tradeCash.reduce((sum, entry) => sum + entry.amount, 0) +
      taxAdjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0) +
      PLAYER_BENEFITS_ESTIMATE +
      PRE_ARB_BONUS_POOL_SHARE;
    const luxuryTax = computeLuxuryTax(taxPayroll, payorStatus);

    return {
      rows,
      totals,
      total,
      future,
      currentOtherPayments,
      deferred,
      taxPayroll,
      taxAdjustments,
      luxuryTax,
      minorsCount,
      tradeCash,
    };
  }, [fortyMan, reserveIL, deadMoney, contractFor, teamId, payorStatus, allSlots, assignments, roster, sixtyDayIL, transactions]);

  const addPool = useMemo((): SimplePlayer[] => {
    const trimmed = stripDiacritics(addQuery.trim().toLowerCase());
    const matches = (player: SimplePlayer) =>
      !fortyManIds.has(player.id) && (!trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed));

    if (addTab === "prospects") {
      return sortByLastName(systemProspects.filter(matches)).slice(0, 8);
    }

    return [];
  }, [addTab, addQuery, systemProspects, fortyManIds]);

  const freeAgentPool = useMemo(() => {
    const trimmed = stripDiacritics(addQuery.trim().toLowerCase());

    return sortByLastName(
      FREE_AGENTS.filter((player) => !fortyManIds.has(player.id))
        .filter((player) => freeAgentFilter === "all" || player.groups.includes(freeAgentFilter))
        .filter((player) => !trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed))
    );
  }, [addQuery, freeAgentFilter, fortyManIds]);

  const openSlotDef = allSlots.find((slot) => slot.id === openSlotId) ?? null;

  const slotEligiblePlayers = useMemo(() => {
    if (!openSlotDef) {
      return [];
    }

    const wantsPitcher = isPitcherSlot(openSlotDef.group);
    const trimmed = stripDiacritics(slotQuery.trim().toLowerCase());

    return fortyMan
      .filter((player) => canFillSlot(player, openSlotDef.group))
      // A two-way player can still be picked for the side he isn't on yet.
      .filter((player) => {
        const side = assignedSides.get(player.id);
        return !side || (isTwoWay(player) && !(wantsPitcher ? side.pitching : side.hitting));
      })
      .filter((player) => !trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed))
      // Best fit for the spot first (see slotFit), then by last name.
      .map((player) => ({ player, fit: slotFit(player, openSlotDef, usageById[player.id]) }))
      .sort((a, b) => b.fit - a.fit || compareByLastName(a.player, b.player))
      .slice(0, 12)
      .map(({ player }) => player);
  }, [openSlotDef, fortyMan, assignedSides, slotQuery, usageById]);

  // Created players have negative ids, so slot lookups can't use a
  // sentinel id for "empty" — check for an assignment explicitly.
  function playerInSlot(slotId: string) {
    const playerId = assignments[slotId];
    return playerId == null ? null : fortyManById.get(playerId) ?? null;
  }

  // The lineup is always generated from whoever is in the defensive
  // alignment: anyone the user has dragged into place keeps their order,
  // and every other starter follows in alignment order.
  const starters = DIAMOND_SLOTS.flatMap((slot) => {
    const player = playerInSlot(slot.id);
    return player ? [{ slot, player }] : [];
  });
  const starterById = new Map(starters.map((starter) => [starter.player.id, starter]));
  const lineup = [
    ...battingOrder.filter((id) => starterById.has(id)),
    ...starters.map((starter) => starter.player.id).filter((id) => !battingOrder.includes(id)),
  ];

  // Dragging a hitter onto another spot moves them there; everyone between
  // shifts by one.
  function moveLineupSpot(from: number, to: number) {
    const next = [...lineup];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setBattingOrder(next);
  }

  // Clears just this slot (a two-way player keeps his other one).
  function clearSlot(slot: SlotDef) {
    setAssignments((current) => ({ ...current, [slot.id]: null }));
  }

  function unassignPlayer(playerId: number) {
    setAssignments((current) => {
      const next = { ...current };
      for (const slotId of Object.keys(next)) {
        if (next[slotId] === playerId) {
          next[slotId] = null;
        }
      }
      return next;
    });
  }

  // A player holds one slot — a two-way player one per side — so moving
  // them frees the slot they were in on that side.
  function assignPlayerToSlot(slot: SlotDef, playerId: number) {
    const twoWay = isTwoWay(fortyManById.get(playerId) ?? { position: "" });
    setAssignments((current) => {
      const next = { ...current };
      for (const slotId of Object.keys(next)) {
        const group = slotGroupById(slotId);
        const sameSide = !twoWay || (group !== null && isPitcherSlot(group) === isPitcherSlot(slot.group));
        if (next[slotId] === playerId && sameSide) {
          next[slotId] = null;
        }
      }
      next[slot.id] = playerId;
      return next;
    });
  }

  function handleDragStart(event: React.DragEvent, playerId: number) {
    event.dataTransfer.setData(PLAYER_ID_DRAG_TYPE, String(playerId));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDropOnSlot(slot: SlotDef, event: React.DragEvent) {
    event.preventDefault();
    const playerId = Number(event.dataTransfer.getData(PLAYER_ID_DRAG_TYPE));
    const player = fortyManById.get(playerId);

    if (!player || !canFillSlot(player, slot.group)) {
      return;
    }

    assignPlayerToSlot(slot, playerId);
  }

  function handleDropOnRosterList(event: React.DragEvent) {
    event.preventDefault();
    const playerId = Number(event.dataTransfer.getData(PLAYER_ID_DRAG_TYPE));
    if (!Number.isNaN(playerId)) {
      unassignPlayer(playerId);
    }
  }

  function toggleSlotOpen(slot: SlotDef) {
    setSlotQuery("");
    setOpenSlotId((current) => (current === slot.id ? null : slot.id));
  }

  function selectForSlot(slot: SlotDef, player: SimplePlayer) {
    assignPlayerToSlot(slot, player.id);
    setOpenSlotId(null);
    setSlotQuery("");
  }

  function addToFortyMan(player: SimplePlayer): boolean {
    if (fortyManIds.has(player.id)) {
      return true;
    }

    const projected = fortyMan.length + 1;

    if (projected > FORTY_MAN_LIMIT) {
      const confirmed = window.confirm(
        `Adding ${player.fullName} would put the 40-man roster at ${projected}, over the ${FORTY_MAN_LIMIT}-man limit. Add anyway?`
      );

      if (!confirmed) {
        return false;
      }
    }

    setFortyMan((current) => [
      ...current,
      {
        id: player.id,
        fullName: player.fullName,
        lastName: player.lastName,
        position: player.position,
        debutDate: player.debutDate,
        bats: player.bats,
        throws: player.throws,
      },
    ]);
    return true;
  }

  function setSigning(playerId: number, signing: Signing) {
    setSignings((current) => ({ ...current, [playerId]: signing }));
  }

  function logTransaction(transaction: Omit<Transaction, "id">) {
    const id = nextTransactionId.current;
    nextTransactionId.current += 1;
    setTransactions((current) => [{ id, ...transaction }, ...current]);
  }

  function signFreeAgent(freeAgent: FreeAgent, signing: Signing) {
    const signingBefore = signings[freeAgent.id] ?? null;

    if (addToFortyMan(freeAgent)) {
      setSigning(freeAgent.id, signing);
      logTransaction({
        kind: "signing",
        summary: `Signed ${freeAgent.fullName} (${freeAgent.groups.join("/")}, ${getTeamAbbreviation(freeAgent.teamId)})`,
        detail: signedContract(signing).detail,
        incoming: [toSimplePlayer(freeAgent)],
        outgoing: [],
        signingsBefore: { [freeAgent.id]: signingBefore },
      });
    }
  }

  // Everyone currently with the club, for the Extensions tab.
  const extensionPool = useMemo(() => {
    const trimmed = stripDiacritics(addQuery.trim().toLowerCase());
    return sortByLastName(
      [...fortyMan, ...reserveIL].filter(
        (player) => !trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed)
      )
    );
  }, [fortyMan, reserveIL, addQuery]);

  // When an extension can start: right away (replacing the current deal) or
  // the season after the current deal's last guaranteed year.
  function extensionStartOptions(player: SimplePlayer): number[] {
    const current = getContract(player);
    const guaranteedSeasons = Object.keys(current?.salaryBySeason ?? {}).map(Number);
    const lastCurrentSeason =
      (current?.status === "guaranteed" || current?.status === "player-option") && guaranteedSeasons.length > 0
        ? Math.max(...guaranteedSeasons)
        : CONTRACT_SEASON;
    return [CONTRACT_SEASON, lastCurrentSeason + 1];
  }

  // An extension for someone already on the roster, logged (and undoable)
  // like a free-agent signing.
  function extendPlayer(player: SimplePlayer, signing: Signing) {
    const signingBefore = signings[player.id] ?? null;
    setSigning(player.id, signing);
    logTransaction({
      kind: "extension",
      summary: `Extended ${player.fullName} (${positionLabel(player)})`,
      detail: signedContract(signing).detail,
      incoming: [],
      outgoing: [],
      signingsBefore: { [player.id]: signingBefore },
    });
  }

  function toSimplePlayer(player: SimplePlayer): SimplePlayer {
    return {
      id: player.id,
      fullName: player.fullName,
      lastName: player.lastName,
      position: player.position,
      debutDate: player.debutDate,
      bats: player.bats,
      throws: player.throws,
    };
  }

  // Load a club's whole system the first time it's picked in the trade
  // builder.
  useEffect(() => {
    if (tradeTeamId === null || orgPlayers[tradeTeamId]) {
      return;
    }

    const teamId = tradeTeamId;
    setOrgPlayers((current) => ({ ...current, [teamId]: "loading" }));

    fetch(`/api/org-players?teamId=${teamId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((data: { players: ProspectPlayer[]; usage?: Record<number, PositionUsage> }) => {
        setOrgPlayers((current) => ({ ...current, [teamId]: data.players.map((player) => ({ ...player, teamId })) }));
        setUsageById((current) => ({ ...data.usage, ...current }));
      })
      .catch(() => setOrgPlayers((current) => ({ ...current, [teamId]: "error" })));
  }, [tradeTeamId, orgPlayers]);

  const tradeTeamPlayers = tradeTeamId !== null ? orgPlayers[tradeTeamId] : undefined;
  const tradeTeamResults = useMemo(() => {
    if (!Array.isArray(tradeTeamPlayers)) {
      return [];
    }
    const trimmed = stripDiacritics(addQuery.trim().toLowerCase());
    return sortWithinLevels(
      tradeTeamPlayers.filter((player) => !trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed))
    );
  }, [tradeTeamPlayers, addQuery]);

  // A club's system is loaded once and cached, so it still lists players
  // since acquired from it — they can't be added again.
  function addToTrade(player: TradePiece) {
    if (orgSystemIds.has(player.id)) {
      return;
    }
    setTradeIncoming((current) => (current.some((piece) => piece.id === player.id) ? current : [...current, player]));
  }

  function cancelTrade() {
    setTradeIncoming([]);
    setTradeOutgoingIds([]);
    setTradeQuery("");
    setTradeCashOut("");
    setTradeCashIn("");
  }


  // Everyone the club could send out: the 40-man, the 60-day IL, and
  // the minor leagues.
  const reserveIds = useMemo(() => new Set(reserveIL.map((player) => player.id)), [reserveIL]);
  const orgSystem = useMemo<SystemPlayer[]>(
    () => [
      ...fortyMan.map((player) => ({ ...player, level: FORTY_MAN_LEVEL })),
      ...reserveIL.map((player) => ({ ...player, level: INJURED_LEVEL })),
      ...systemProspects.filter((player) => !fortyManIds.has(player.id) && !reserveIds.has(player.id)),
    ],
    [fortyMan, reserveIL, systemProspects, fortyManIds, reserveIds]
  );
  const orgSystemIds = useMemo(() => new Set(orgSystem.map((player) => player.id)), [orgSystem]);

  const tradeOutgoing = tradeOutgoingIds
    .map((id) => orgSystem.find((player) => player.id === id))
    .filter((player): player is SystemPlayer => player !== undefined);

  const cashOut = parseMillions(tradeCashOut) ?? 0;
  const cashIn = parseMillions(tradeCashIn) ?? 0;
  const tradeHasPieces = tradeIncoming.length > 0 || tradeOutgoing.length > 0 || cashOut > 0 || cashIn > 0;

  const tradeCandidates = useMemo(() => {
    const trimmed = stripDiacritics(tradeQuery.trim().toLowerCase());
    // 40-man first, then the IL and the minors (the list scrolls).
    return sortWithinLevels(
      orgSystem
        .filter((player) => !tradeOutgoingIds.includes(player.id))
        .filter((player) => !trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed))
    );
  }, [orgSystem, tradeOutgoingIds, tradeQuery]);

  function describeTradePiece(player: SystemPlayer & { teamId?: number }) {
    const where = [
      positionLabel(player),
      player.teamId ? getTeamAbbreviation(player.teamId) : null,
      player.level !== FORTY_MAN_LEVEL ? player.level : null,
    ].filter(Boolean);
    return `${player.fullName} (${where.join(", ")})`;
  }

  // Incoming 40-man players join the 40-man and incoming minor leaguers join
  // the system; everyone sent out leaves (their contracts go with them — no
  // dead money).
  function completeTrade() {
    if (!tradeHasPieces) {
      return;
    }

    // Never acquire someone who's already in the organization (e.g. a piece added
    // before an earlier trade brought them over).
    const alreadyHere = tradeIncoming.filter((player) => orgSystemIds.has(player.id));
    if (alreadyHere.length > 0) {
      window.alert(
        `${alreadyHere.map((player) => player.fullName).join(", ")} ${
          alreadyHere.length === 1 ? "is" : "are"
        } already in the ${team.shortName} organization and ${alreadyHere.length === 1 ? "was" : "were"} taken out of this trade.`
      );
      setTradeIncoming((current) => current.filter((player) => !orgSystemIds.has(player.id)));
      return;
    }

    const incomingFortyMan = tradeIncoming.filter((player) => player.level === FORTY_MAN_LEVEL).map(toSimplePlayer);
    const incomingProspects = tradeIncoming
      .filter((player) => player.level !== FORTY_MAN_LEVEL)
      .map((player) => ({ ...toSimplePlayer(player), level: player.level }));
    const outgoingFortyMan = tradeOutgoing.filter((player) => player.level === FORTY_MAN_LEVEL).map(toSimplePlayer);
    const outgoingInjured = tradeOutgoing.filter((player) => player.level === INJURED_LEVEL).map(toSimplePlayer);
    const outgoingProspects = tradeOutgoing.filter(
      (player) => player.level !== FORTY_MAN_LEVEL && player.level !== INJURED_LEVEL
    );

    const projected = fortyMan.length + incomingFortyMan.length - outgoingFortyMan.length;
    if (
      projected > FORTY_MAN_LIMIT &&
      !window.confirm(
        `This trade would put the 40-man roster at ${projected}, over the ${FORTY_MAN_LIMIT}-man limit. Make it anyway?`
      )
    ) {
      return;
    }

    const ids = (players: SimplePlayer[]) => new Set(players.map((player) => player.id));
    const outFortyManIds = ids(outgoingFortyMan);
    const outInjuredIds = ids(outgoingInjured);
    const outProspectIds = ids(outgoingProspects);
    const salaryOf = (players: SimplePlayer[]) =>
      players.reduce((sum, player) => sum + (contractFor(player)?.salary ?? 0), 0);
    const outgoingSalary = salaryOf([...outgoingFortyMan, ...outgoingInjured]);
    const incomingSalary = salaryOf(incomingFortyMan);

    // Each update also skips anyone already present, so a player can never
    // end up listed twice.
    setFortyMan((current) => {
      const kept = current.filter((player) => !outFortyManIds.has(player.id));
      const keptIds = ids(kept);
      return [...kept, ...incomingFortyMan.filter((player) => !keptIds.has(player.id))];
    });
    setReserveIL((current) => current.filter((player) => !outInjuredIds.has(player.id)));
    setSystemProspects((current) => {
      const kept = current.filter((player) => !outProspectIds.has(player.id));
      const keptIds = ids(kept);
      return [...kept, ...incomingProspects.filter((player) => !keptIds.has(player.id))];
    });
    for (const id of outFortyManIds) {
      unassignPlayer(id);
    }

    logTransaction({
      kind: "trade",
      summary: `Acquired ${describeSide(tradeIncoming.map(describeTradePiece), cashIn)} for ${describeSide(
        tradeOutgoing.map(describeTradePiece),
        cashOut
      )}`,
      detail:
        [
          outgoingSalary > 0 || incomingSalary > 0
            ? `Est. ${CONTRACT_SEASON} salary: ${formatSalary(incomingSalary)} in, ${formatSalary(outgoingSalary)} out`
            : null,
          cashOut - cashIn !== 0
            ? `${formatSalary(Math.abs(cashOut - cashIn))} net cash ${cashOut > cashIn ? "sent" : "received"} (${CONTRACT_SEASON})`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      cash: cashOut - cashIn !== 0 ? cashOut - cashIn : undefined,
      partnerTeamId: tradeTeamId ?? tradeIncoming[0]?.teamId,
      incoming: incomingFortyMan,
      outgoing: outgoingFortyMan,
      signingsBefore: {},
      outgoingInjured,
      outgoingProspects,
      incomingProspects,
    });

    cancelTrade();
  }

  // "Player A, Player B and $5M cash" / "$5M cash" / "nothing".
  function describeSide(pieces: string[], cash: number) {
    const parts = [...pieces, ...(cash > 0 ? [`${formatSalary(cash)} cash`] : [])];
    return parts.length > 0 ? parts.join(", ") : "nothing";
  }

  // A move can be undone as long as nothing later has built on it: everyone
  // it brought in is still where it put them and nobody it sent out is back.
  function undoBlockedReason(transaction: Transaction): string | null {
    const prospectIds = new Set(systemProspects.map((player) => player.id));

    if (
      transaction.incoming.some((player) => !fortyManIds.has(player.id)) ||
      (transaction.incomingProspects ?? []).some((player) => !prospectIds.has(player.id) || fortyManIds.has(player.id))
    ) {
      return "A player from this move has since moved again — undo that move first.";
    }

    if (
      transaction.outgoing.some((player) => fortyManIds.has(player.id)) ||
      (transaction.outgoingInjured ?? []).some((player) => fortyManIds.has(player.id) || reserveIds.has(player.id)) ||
      (transaction.outgoingProspects ?? []).some((player) => prospectIds.has(player.id))
    ) {
      return "A player sent out in this move is back in the organization.";
    }

    return null;
  }

  function undoTransaction(transaction: Transaction) {
    if (undoBlockedReason(transaction)) {
      return;
    }

    const incomingIds = new Set(transaction.incoming.map((player) => player.id));
    const incomingProspectIds = new Set((transaction.incomingProspects ?? []).map((player) => player.id));

    setFortyMan((current) => [...current.filter((player) => !incomingIds.has(player.id)), ...transaction.outgoing]);
    setReserveIL((current) => [...current, ...(transaction.outgoingInjured ?? []), ...(transaction.fromIL ?? [])]);
    setSystemProspects((current) => [
      ...current.filter((player) => !incomingProspectIds.has(player.id)),
      ...(transaction.outgoingProspects ?? []),
    ]);
    for (const id of incomingIds) {
      unassignPlayer(id);
    }

    setSignings((current) => {
      const next = { ...current };
      for (const [id, signing] of Object.entries(transaction.signingsBefore)) {
        if (signing) {
          next[Number(id)] = signing;
        } else {
          delete next[Number(id)];
        }
      }
      return next;
    });

    setTransactions((current) => current.filter((entry) => entry.id !== transaction.id));
  }

  // A created player needs a name; the contract (same form as free agents,
  // including custom-by-year salaries and deferrals) is optional.
  const canCreate = !!createFirstName.trim() && !!createLastName.trim();

  function createPlayer(createSigning?: Signing) {
    const first = createFirstName.trim();
    const last = createLastName.trim();

    if (!canCreate) {
      return;
    }

    const player: SimplePlayer = {
      id: nextCreatedId.current,
      fullName: `${first} ${last}`,
      lastName: last,
      position: createPosition,
      bats: createBats,
      throws: createThrows,
    };

    if (addToFortyMan(player)) {
      if (createSigning) {
        setSigning(player.id, createSigning);
        logTransaction({
          kind: "signing",
          summary: `Signed ${player.fullName} (${player.position}, created player)`,
          detail: signedContract(createSigning).detail,
          incoming: [player],
          outgoing: [],
          signingsBefore: { [player.id]: null },
        });
      }

      nextCreatedId.current -= 1;
      setCreateFirstName("");
      setCreateLastName("");
    }
  }

  function activateFromIL(player: SimplePlayer) {
    if (addToFortyMan(player)) {
      setReserveIL((current) => current.filter((p) => p.id !== player.id));
      logTransaction({
        kind: "activation",
        summary: `Activated ${player.fullName} (${positionLabel(player)}) from the 60-day IL`,
        incoming: [toSimplePlayer(player)],
        outgoing: [],
        signingsBefore: {},
        fromIL: [toSimplePlayer(player)],
      });
    }
  }

  // Adding a minor leaguer to the 40-man. They stay in `systemProspects`,
  // so undoing this just takes them back off the 40-man.
  function selectContract(player: SimplePlayer) {
    if (fortyManIds.has(player.id) || !addToFortyMan(player)) {
      return;
    }

    logTransaction({
      kind: "selection",
      summary: `Selected the contract of ${player.fullName} (${[positionLabel(player), player.level].filter(Boolean).join(", ")})`,
      incoming: [toSimplePlayer(player)],
      outgoing: [],
      signingsBefore: {},
    });
  }

  // Dropping a player is a logged (and undoable) move whose meaning depends
  // on their contract: a declined club option, a non-tender, or a DFA.
  function removeFromFortyMan(playerId: number) {
    const player = fortyManById.get(playerId);
    if (!player) {
      return;
    }

    const contract = contractFor(player);
    const kind = removalKind(contract);
    const guaranteed = contract?.status === "guaranteed" || contract?.status === "signed";

    setFortyMan((current) => current.filter((p) => p.id !== playerId));
    unassignPlayer(playerId);

    logTransaction({
      kind,
      summary:
        kind === "opt-out"
          ? `${player.fullName} opted out of his contract`
          : kind === "option"
          ? `Declined ${player.fullName}'s ${
              contract?.status === "mutual-option" ? "mutual" : contract?.status === "vesting-option" ? "vesting" : "club"
            } option`
          : kind === "non-tender"
            ? `Non-tendered ${player.fullName}`
            : `Designated ${player.fullName} for assignment`,
      detail:
        kind === "opt-out" && contract
          ? contract.buyout
            ? `${formatSalary(contract.salary)} comes off the payroll; the ${formatSalary(contract.buyout)} buyout stays on as dead money`
            : `${formatSalary(contract.salary)} comes off the payroll`
          : kind === "option" && contract
          ? contract.buyout
            ? `${formatSalary(contract.salary)} option comes off the payroll; the ${formatSalary(contract.buyout)} buyout stays on as dead money`
            : `${formatSalary(contract.salary)} option comes off the payroll`
          : kind === "non-tender" && contract
            ? `${formatSalary(contract.salary)} projected salary comes off the payroll`
            : guaranteed && contract
              ? `${formatSalary(contract.salary)} in ${CONTRACT_SEASON} stays on the payroll as dead money`
              : undefined,
      incoming: [],
      outgoing: [toSimplePlayer(player)],
      signingsBefore: {},
    });
  }

  const [graphicStatus, setGraphicStatus] = useState<"idle" | "working" | "error">("idle");

  // Switching clubs loads that club's roster fresh, so any moves made here
  // are lost — confirm first if there are any.
  function switchTeam(nextTeamId: number) {
    if (nextTeamId === teamId) {
      return;
    }
    const hasWork = transactions.length > 0 || filledCount > 0 || Object.keys(signings).length > 0;
    if (
      hasWork &&
      !window.confirm(`Switch to the ${getTeamInfo(nextTeamId).name}? Your ${team.shortName} roster and moves will be cleared.`)
    ) {
      return;
    }
    router.push(`/gm-simulator?team=${getTeamAbbreviation(nextTeamId).toLowerCase()}`);
  }

  async function downloadGraphic() {
    // Batting side only for hitting slots (a two-way player pitching shows
    // his throwing hand as the position instead).
    const toGraphic = (player: SimplePlayer, pitching = false): GraphicPlayer => ({
      id: player.id,
      name: player.fullName,
      hand: player.position === "P" || pitching ? undefined : player.bats,
    });
    const slotRows = (slots: SlotDef[], badge: (index: number, slot: SlotDef) => string | undefined): GraphicRow[] =>
      slots.map((slot, index) => {
        const player = playerInSlot(slot.id);
        return {
          badge: badge(index, slot),
          player: player && toGraphic(player, isPitcherSlot(slot.group)),
          tag: player ? slotPositionLabel(player, slot.group) : undefined,
        };
      });

    const lineupRows: GraphicRow[] = Array.from({ length: LINEUP_SPOTS }, (_, index) => {
      const starter = index < lineup.length ? starterById.get(lineup[index]) : undefined;
      return { badge: String(index + 1), player: starter ? toGraphic(starter.player) : null, tag: starter?.slot.label };
    });

    setGraphicStatus("working");
    try {
      const blob = await renderRosterGraphic({
        season: CONTRACT_SEASON,
        team,
        left: [
          { title: "Lineup", rows: lineupRows },
          { title: "Bench", rows: slotRows(benchSlots, () => undefined) },
        ],
        right: [
          { title: "Rotation", rows: slotRows(ROTATION_SLOTS, (index) => String(index + 1)) },
          { title: "Bullpen", rows: slotRows(bullpenSlots, (_, slot) => (BULLPEN_ROLE_IDS.has(slot.id) ? slot.label : undefined)) },
        ],
        stats: [
          { label: `Est. ${CONTRACT_SEASON} Payroll`, value: formatSalary(payroll.total) },
          { label: "Tax Payroll", value: formatSalary(payroll.taxPayroll) },
          { label: "40-Man", value: `${fortyMan.length} / ${FORTY_MAN_LIMIT}` },
          { label: "Active", value: `${filledCount} / ${TOTAL_SLOTS}` },
        ],
        transactions: transactions.map((transaction) => ({
          label: TRANSACTION_LABELS[transaction.kind].label,
          color: TRANSACTION_LABELS[transaction.kind].color,
          summary: transaction.summary,
          detail: transaction.detail,
        })),
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${teamAbbreviation.toLowerCase()}-${CONTRACT_SEASON}-roster.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setGraphicStatus("idle");
    } catch {
      setGraphicStatus("error");
    }
  }

  const addTabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "0.45rem 0.9rem",
    borderRadius: "999px",
    border: `1px solid ${isActive ? "#8a1024" : "var(--line)"}`,
    background: isActive ? "rgba(196,30,58,0.18)" : "var(--panel)",
    color: "var(--text)",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "0.85rem",
  });

  const createFieldStyle: React.CSSProperties = {
    padding: "0.6rem 0.9rem",
    borderRadius: "999px",
    border: "1px solid var(--line)",
    background: "var(--bg-soft)",
    color: "var(--text)",
    fontSize: "0.95rem",
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {openSlotId && (
        <div onClick={() => setOpenSlotId(null)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
      )}

      <div
        className="roster-builder-team-bar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.85rem",
          flexWrap: "wrap",
          padding: "0.75rem 1rem",
          borderRadius: "18px",
          border: "1px solid var(--line)",
          borderLeft: `6px solid ${team.highlight}`,
          background: "var(--panel)",
        }}
      >
        <TeamLogo src={teamLogoUrl(teamId)} alt="" style={{ width: "44px", height: "44px", objectFit: "contain" }} />
        <div style={{ display: "grid", gap: "0.1rem", minWidth: 0 }}>
          <span className="kicker" style={{ margin: 0, fontSize: "0.7rem" }}>
            Building
          </span>
          <strong style={{ fontSize: "1.2rem", lineHeight: 1.1 }}>{team.name}</strong>
        </div>
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)" }}>Team</span>
          <select
            value={teamId}
            onChange={(event) => switchTeam(Number(event.target.value))}
            aria-label="Team to build"
            style={{
              padding: "0.55rem 1rem",
              borderRadius: "999px",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--text)",
              fontWeight: 700,
              fontSize: "0.92rem",
            }}
          >
            {ALL_TEAMS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <p style={{ margin: 0, color: "var(--muted)", fontWeight: 700 }}>
          {filledCount} / {TOTAL_SLOTS} roster spots filled
        </p>
        {twoWayPlayer && (
          <div
            role="group"
            aria-label="Extra roster spot"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              padding: "0.35rem 0.4rem 0.35rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid var(--line)",
              background: "rgba(15,42,82,0.05)",
              fontSize: "0.8rem",
            }}
          >
            <span>
              <strong>{displayLastName(twoWayPlayer)}</strong> is hitting and pitching — one roster spot, so one extra
              spot opens:
            </span>
            {(["bullpen", "bench"] as ExtraSpot[]).map((spot) => (
              <button
                key={spot}
                type="button"
                aria-pressed={extraSpot === spot}
                onClick={() => setExtraSpot(spot)}
                style={{
                  ...smallButtonStyle,
                  padding: "0.25rem 0.75rem",
                  borderColor: extraSpot === spot ? "#8a1024" : "var(--line)",
                  background: extraSpot === spot ? "rgba(196,30,58,0.15)" : "var(--panel)",
                }}
              >
                {spot === "bullpen" ? "Bullpen" : "Bench"}
              </button>
            ))}
          </div>
        )}
        {graphicStatus === "error" && (
          <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#b42318" }}>
            Couldn&apos;t create the graphic — try again.
          </span>
        )}
        <button
          type="button"
          onClick={downloadGraphic}
          disabled={graphicStatus === "working"}
          style={{
            ...smallButtonStyle,
            marginLeft: graphicStatus === "error" ? 0 : "auto",
            background: "var(--accent)",
            borderColor: "var(--accent)",
            color: "#fff",
            padding: "0.45rem 1rem",
            opacity: graphicStatus === "working" ? 0.6 : 1,
          }}
        >
          {graphicStatus === "working" ? "Creating graphic…" : "Download roster graphic"}
        </button>
      </div>

      <div
        className="roster-builder-field"
        style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "minmax(280px, 420px) 1fr" }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
            <p className="kicker" style={{ margin: 0 }}>
              {positionView === "defense" ? "Position Players" : `Lineup (${lineup.length} / ${LINEUP_SPOTS})`}
            </p>
            <button
              type="button"
              onClick={() => {
                setOpenSlotId(null);
                setPositionView((view) => (view === "defense" ? "lineup" : "defense"));
              }}
              style={{
                ...smallButtonStyle,
                marginLeft: "auto",
                padding: "0.3rem 0.85rem",
                fontSize: "0.75rem",
                fontWeight: 800,
                letterSpacing: "0.06em",
                border: "1px solid #8a1024",
                background: "rgba(196,30,58,0.12)",
              }}
            >
              {positionView === "defense" ? "EDIT LINEUP" : "EDIT DEFENSE"}
            </button>
          </div>
          {positionView === "lineup" ? (
            <div
              style={{
                borderRadius: "18px",
                border: "1px solid var(--line)",
                background: "var(--panel)",
                padding: "0.85rem",
                display: "grid",
                gap: "0.4rem",
              }}
            >
              {Array.from({ length: LINEUP_SPOTS }, (_, index) => {
                const starter = index < lineup.length ? starterById.get(lineup[index]) : undefined;

                return (
                  <div
                    key={index}
                    draggable={!!starter}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(LINEUP_SPOT_DRAG_TYPE, String(index));
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const data = event.dataTransfer.getData(LINEUP_SPOT_DRAG_TYPE);
                      const target = Math.min(index, lineup.length - 1);
                      if (data !== "" && Number(data) !== target) {
                        moveLineupSpot(Number(data), target);
                      }
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6rem 1fr auto",
                      alignItems: "center",
                      gap: "0.5rem",
                      minHeight: "2.6rem",
                      padding: "0.3rem 0.55rem",
                      borderRadius: "10px",
                      border: "1px solid var(--line)",
                      background: starter ? "rgba(196,30,58,0.08)" : "transparent",
                      cursor: starter ? "grab" : "default",
                    }}
                  >
                    <span style={{ fontWeight: 800, color: "var(--muted)", textAlign: "center" }}>{index + 1}</span>
                    {starter ? (
                      <>
                        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                          <PlayerName player={starter.player} />
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 700 }}>{starter.slot.label}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)", gridColumn: "2 / span 2" }}>
                        Open — fill this spot in the defense
                      </span>
                    )}
                  </div>
                );
              })}
              <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>
                Built from the defense. Drag a hitter to another spot to move them.
              </p>
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                aspectRatio: "1 / 1.15",
                borderRadius: "18px",
                border: "1px solid var(--line)",
                background: "var(--panel)",
              }}
            >
              {DIAMOND_SLOTS.map((slot) => (
                <SlotCell
                  key={slot.id}
                  slot={slot}
                  player={playerInSlot(slot.id)}
                  isOpen={openSlotId === slot.id}
                  onToggleOpen={toggleSlotOpen}
                  onDrop={handleDropOnSlot}
                  onDragStart={handleDragStart}
                  onClear={clearSlot}
                  query={slotQuery}
                  onQueryChange={setSlotQuery}
                  eligiblePlayers={slotEligiblePlayers}
                  onSelect={selectForSlot}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="kicker" style={{ marginBottom: "0.6rem" }}>
            Rotation
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "0.5rem" }}>
            {ROTATION_SLOTS.map((slot) => (
              <SlotCell
                key={slot.id}
                slot={slot}
                player={playerInSlot(slot.id)}
                isOpen={openSlotId === slot.id}
                onToggleOpen={toggleSlotOpen}
                onDrop={handleDropOnSlot}
                onDragStart={handleDragStart}
                onClear={clearSlot}
                query={slotQuery}
                onQueryChange={setSlotQuery}
                eligiblePlayers={slotEligiblePlayers}
                onSelect={selectForSlot}
              />
            ))}
          </div>

          <p className="kicker" style={{ margin: "1.25rem 0 0.6rem" }}>
            Bullpen
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "0.5rem" }}>
            {bullpenSlots.map((slot) => (
              <SlotCell
                key={slot.id}
                slot={slot}
                player={playerInSlot(slot.id)}
                isOpen={openSlotId === slot.id}
                onToggleOpen={toggleSlotOpen}
                onDrop={handleDropOnSlot}
                onDragStart={handleDragStart}
                onClear={clearSlot}
                query={slotQuery}
                onQueryChange={setSlotQuery}
                eligiblePlayers={slotEligiblePlayers}
                onSelect={selectForSlot}
              />
            ))}
          </div>

          <p className="kicker" style={{ margin: "1.25rem 0 0.6rem" }}>
            Bench
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "0.5rem" }}>
            {benchSlots.map((slot) => (
              <SlotCell
                key={slot.id}
                slot={slot}
                player={playerInSlot(slot.id)}
                isOpen={openSlotId === slot.id}
                onToggleOpen={toggleSlotOpen}
                onDrop={handleDropOnSlot}
                onDragStart={handleDragStart}
                onClear={clearSlot}
                query={slotQuery}
                onQueryChange={setSlotQuery}
                eligiblePlayers={slotEligiblePlayers}
                onSelect={selectForSlot}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="kicker" style={{ marginBottom: "0.6rem" }}>
          40-Man Roster ({fortyMan.length} / {FORTY_MAN_LIMIT})
        </p>
        {departingFreeAgents.length > 0 && (
          <p style={{ margin: "-0.25rem 0 0.6rem", color: "var(--muted)", fontSize: "0.8rem" }}>
            Left off as impending free agents: {departingFreeAgents.join(", ")}. Re-sign them from the Free Agents tab.
          </p>
        )}
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDropOnRosterList}
          style={{
            border: "1px solid var(--line)",
            borderRadius: "18px",
            background: "var(--panel)",
            padding: "1.15rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          {fortyMan.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>No players on the 40-man roster.</p>
          ) : (
            sortByLastName(fortyMan).map((player) => (
              <span
                key={player.id}
                draggable
                onDragStart={(event) => handleDragStart(event, player.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.3rem 0.3rem 0.3rem 0.7rem",
                  borderRadius: "999px",
                  border: "1px solid var(--line)",
                  background: assignedIds.has(player.id) ? "rgba(196,30,58,0.08)" : "rgba(15,31,61,0.02)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "grab",
                }}
              >
                <PlayerName player={player} />
                <span style={{ color: "var(--muted)", fontWeight: 400 }} title={handTitle(player)}>
                  {positionLabel(player)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFromFortyMan(player.id)}
                  aria-label={`Remove ${player.fullName} from the 40-man roster`}
                  title={removalTitle(contractFor(player))}
                  style={{
                    width: "1.3rem",
                    height: "1.3rem",
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(180,35,24,0.12)",
                    color: "#b42318",
                    fontWeight: 800,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="kicker" style={{ marginBottom: "0.6rem" }}>
          60-Day IL &amp; Restricted (Outside 40-Man)
        </p>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "18px",
            background: "var(--panel)",
            padding: "1.15rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          {reserveIL.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No players currently on the 60-day IL outside the 40-man.
            </p>
          ) : (
            sortByLastName(reserveIL).map((player) => (
              <span
                key={player.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.3rem 0.3rem 0.3rem 0.7rem",
                  borderRadius: "999px",
                  border: "1px solid var(--line)",
                  background: "rgba(15,31,61,0.02)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
              >
                <PlayerName player={player} />
                <span style={{ color: "var(--muted)", fontWeight: 400 }} title={handTitle(player)}>
                  {positionLabel(player)}
                </span>
                <button
                  type="button"
                  onClick={() => activateFromIL(player)}
                  aria-label={`Activate ${player.fullName} onto the 40-man roster`}
                  title="Activate onto 40-man"
                  style={{
                    width: "1.3rem",
                    height: "1.3rem",
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(15,122,56,0.15)",
                    color: "#0f7a38",
                    fontWeight: 800,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <div>
        <p className="kicker" style={{ marginBottom: "0.6rem" }}>
          Roster Moves
        </p>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "18px",
            background: "var(--panel)",
            padding: "1.15rem",
            display: "grid",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              style={addTabButtonStyle(addTab === "prospects")}
              onClick={() => { setAddTab("prospects"); setAddQuery(""); }}
            >
              Call-Ups
            </button>
            <button
              type="button"
              style={addTabButtonStyle(addTab === "extensions")}
              onClick={() => { setAddTab("extensions"); setAddQuery(""); }}
            >
              Extensions
            </button>
            <button
              type="button"
              style={addTabButtonStyle(addTab === "free-agents")}
              onClick={() => { setAddTab("free-agents"); setAddQuery(""); }}
            >
              Free Agents
            </button>
            <button
              type="button"
              style={addTabButtonStyle(addTab === "trades")}
              onClick={() => { setAddTab("trades"); setAddQuery(""); }}
            >
              Trades
            </button>
            <button
              type="button"
              style={addTabButtonStyle(addTab === "create")}
              onClick={() => { setAddTab("create"); setAddQuery(""); }}
            >
              Create Player
            </button>
          </div>

          {addTab === "create" ? (
            <div style={{ display: "grid", gap: "0.6rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <select
                value={createPosition}
                onChange={(event) => setCreatePosition(event.target.value)}
                aria-label="Position"
                style={{ ...createFieldStyle, flex: "0 0 auto" }}
              >
                {CREATE_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
              <select
                value={createBats}
                onChange={(event) => setCreateBats(event.target.value)}
                aria-label="Bats"
                style={{ ...createFieldStyle, flex: "0 0 auto" }}
              >
                {HANDS.map((hand) => (
                  <option key={hand} value={hand}>
                    Bats {hand}
                  </option>
                ))}
              </select>
              <select
                value={createThrows}
                onChange={(event) => setCreateThrows(event.target.value)}
                aria-label="Throws"
                style={{ ...createFieldStyle, flex: "0 0 auto" }}
              >
                {HANDS.map((hand) => (
                  <option key={hand} value={hand}>
                    Throws {hand}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={createFirstName}
                onChange={(event) => setCreateFirstName(event.target.value)}
                placeholder="First name"
                aria-label="First name"
                style={{ ...createFieldStyle, flex: "1 1 140px" }}
              />
              <input
                type="text"
                value={createLastName}
                onChange={(event) => setCreateLastName(event.target.value)}
                placeholder="Last name"
                aria-label="Last name"
                style={{ ...createFieldStyle, flex: "1 1 140px" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span style={{ marginRight: "auto", fontSize: "0.8rem", color: "var(--muted)", alignSelf: "center" }}>
                Contract (optional): total, years, custom by year, or deferrals.
              </span>
              <SignForm submitLabel="Sign to 40-Man" disabled={!canCreate} onSign={(signing) => createPlayer(signing)} />
              <button
                type="button"
                onClick={() => createPlayer()}
                disabled={!canCreate}
                style={{ ...smallButtonStyle, opacity: canCreate ? 1 : 0.5 }}
              >
                Add without contract
              </button>
            </div>
            </div>
          ) : addTab === "extensions" ? (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <input
                type="text"
                value={addQuery}
                onChange={(event) => setAddQuery(event.target.value)}
                placeholder={`Search ${extensionPool.length} ${team.shortName} players to extend...`}
                aria-label="Search players to extend"
                style={{ ...createFieldStyle, width: "100%" }}
              />
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>
                Same deal options as free agents. An extension can replace the current deal starting in{" "}
                {CONTRACT_SEASON} or start the season after it ends. Extensions are logged and can be undone.
              </p>
              <div style={{ display: "grid", gap: "0.5rem", maxHeight: "560px", overflowY: "auto" }}>
                {extensionPool.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--muted)" }}>No matching players.</p>
                ) : (
                  extensionPool.map((player) => {
                    const contract = contractFor(player);
                    const isCreated = player.id < 0;
                    return (
                      <div
                        key={player.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "0.4rem 0.65rem",
                          padding: "0.5rem 0.7rem",
                          borderRadius: "12px",
                          border: "1px solid var(--line)",
                          background: "rgba(15,31,61,0.02)",
                        }}
                      >
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            overflow: "hidden",
                            flexShrink: 0,
                            background: "rgba(15,31,61,.08)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <PlayerHeadshot
                            src={playerHeadshotUrl(player.id, 68)}
                            alt={player.fullName}
                            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                          />
                        </div>
                        <div style={{ display: "grid", gap: "0.1rem", minWidth: 0, flex: "1 1 220px" }}>
                          <span style={{ fontSize: "0.9rem" }}>
                            <span style={{ fontWeight: 700 }}>
                              <PlayerName player={player} showThrows />
                            </span>
                            <span style={{ color: "var(--muted)", marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                              {positionLabel(player)}
                              {contract ? ` · ${CONTRACT_STATUS_LABELS[contract.status]} · ${formatSalary(contract.salary)}` : " · No contract"}
                            </span>
                          </span>
                          <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                            {contract?.detail ?? "No contract set"}
                            {contract?.freeAgentAfter ? ` · FA after ${formatFreeAgentAfter(contract)}` : ""}
                          </span>
                        </div>
                        <div style={{ marginLeft: "auto" }}>
                          <SignForm
                            submitLabel={signings[player.id] ? "Re-sign" : "Extend"}
                            initial={signings[player.id]}
                            startOptions={isCreated ? undefined : extensionStartOptions(player)}
                            onSign={(signing) => extendPlayer(player, signing)}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : addTab === "trades" ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)" }}>PICK A TRADE PARTNER</span>
              <div
                role="radiogroup"
                aria-label="Team to trade with"
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: "0.4rem" }}
              >
                {partnerTeamIds.map((partnerId) => {
                  const selected = partnerId === tradeTeamId;
                  return (
                    <button
                      key={partnerId}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setTradeTeamId(partnerId);
                        setAddQuery("");
                      }}
                      style={{
                        display: "grid",
                        justifyItems: "center",
                        gap: "0.2rem",
                        padding: "0.45rem 0.25rem",
                        borderRadius: "12px",
                        border: `2px solid ${selected ? "var(--accent)" : "var(--line)"}`,
                        background: selected ? "rgba(196,30,58,0.1)" : "var(--panel)",
                        cursor: "pointer",
                        color: "var(--text)",
                      }}
                    >
                      <TeamLogo
                        src={teamLogoUrl(partnerId)}
                        alt=""
                        style={{ width: "34px", height: "34px", objectFit: "contain" }}
                      />
                      <span style={{ fontSize: "0.72rem", fontWeight: 800 }}>{getTeamAbbreviation(partnerId)}</span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  border: `2px solid ${tradeHasPieces ? "var(--accent)" : "var(--line)"}`,
                  borderRadius: "14px",
                  padding: "0.85rem",
                  display: "grid",
                  gap: "0.85rem",
                  background: "rgba(196,30,58,0.03)",
                }}
              >
                <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                  <div style={{ display: "grid", gap: "0.5rem", alignContent: "start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      <TeamLogo
                        src={teamLogoUrl(teamId)}
                        alt=""
                        style={{ width: "26px", height: "26px", objectFit: "contain" }}
                      />
                      <strong style={{ fontSize: "0.9rem" }}>
                        {teamAbbreviation} sends ({tradeOutgoing.length})
                      </strong>
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", minHeight: "1.9rem" }}>
                      {tradeOutgoing.length === 0 ? (
                        <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>No one yet.</span>
                      ) : (
                        tradeOutgoing.map((player) => {
                          const contract = contractFor(player);
                          const paid = player.level === FORTY_MAN_LEVEL || player.level === INJURED_LEVEL;
                          return (
                            <TradeChip
                              key={player.id}
                              player={player}
                              meta={[
                                positionLabel(player),
                                player.level !== FORTY_MAN_LEVEL ? player.level : null,
                                paid && contract ? formatSalary(contract.salary) : null,
                              ]}
                              removeLabel={`Keep ${player.fullName}`}
                              onRemove={() => setTradeOutgoingIds((current) => current.filter((id) => id !== player.id))}
                            />
                          );
                        })
                      )}
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                      <span style={{ fontWeight: 700 }}>+ Cash</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        inputMode="decimal"
                        value={tradeCashOut}
                        onChange={(event) => setTradeCashOut(event.target.value)}
                        placeholder="$M"
                        aria-label="Cash sent in millions"
                        style={{ ...contractFieldStyle, width: "5.5rem" }}
                      />
                      <span>in {CONTRACT_SEASON}</span>
                    </label>
                    <input
                      type="text"
                      value={tradeQuery}
                      onChange={(event) => setTradeQuery(event.target.value)}
                      placeholder={`Search the ${team.shortName} system (40-man, IL, minors)...`}
                      aria-label={`Search ${team.shortName} players to send out`}
                      style={{ ...createFieldStyle, width: "100%", fontSize: "0.88rem" }}
                    />
                    <div style={{ display: "grid", gap: "0.35rem", maxHeight: "360px", overflowY: "auto" }}>
                      {tradeCandidates.length === 0 ? (
                        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>No matching players.</p>
                      ) : (
                        tradeCandidates.map((player) => (
                          <TradeResultRow
                            key={player.id}
                            player={player}
                            onAdd={() =>
                              setTradeOutgoingIds((current) => (current.includes(player.id) ? current : [...current, player.id]))
                            }
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "0.5rem", alignContent: "start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                      {tradeTeamId !== null && (
                        <TeamLogo
                          src={teamLogoUrl(tradeTeamId)}
                          alt=""
                          style={{ width: "26px", height: "26px", objectFit: "contain" }}
                        />
                      )}
                      <strong style={{ fontSize: "0.9rem" }}>
                        {tradeTeamId !== null ? getTeamAbbreviation(tradeTeamId) : "Partner"} sends ({tradeIncoming.length})
                      </strong>
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", minHeight: "1.9rem" }}>
                      {tradeIncoming.length === 0 ? (
                        <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>No one yet.</span>
                      ) : (
                        tradeIncoming.map((player) => (
                          <TradeChip
                            key={player.id}
                            player={player}
                            meta={[
                              positionLabel(player),
                              // Only worth labeling when pieces come from more than one club.
                              player.teamId !== tradeTeamId ? getTeamAbbreviation(player.teamId) : null,
                              player.level !== FORTY_MAN_LEVEL ? player.level : null,
                              // Minor leaguers off the 40-man aren't on the payroll.
                              player.level === FORTY_MAN_LEVEL ? formatSalary(contractFor(player)?.salary ?? 0) : null,
                            ]}
                            removeLabel={`Take ${player.fullName} out of the trade`}
                            onRemove={() => setTradeIncoming((current) => current.filter((piece) => piece.id !== player.id))}
                          />
                        ))
                      )}
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--muted)" }}>
                      <span style={{ fontWeight: 700 }}>+ Cash</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        inputMode="decimal"
                        value={tradeCashIn}
                        onChange={(event) => setTradeCashIn(event.target.value)}
                        placeholder="$M"
                        aria-label="Cash received in millions"
                        style={{ ...contractFieldStyle, width: "5.5rem" }}
                      />
                      <span>in {CONTRACT_SEASON}</span>
                    </label>
                    {tradeTeamId === null ? (
                      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
                        Pick a team above to browse their 40-man and minor leaguers.
                      </p>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={addQuery}
                          onChange={(event) => setAddQuery(event.target.value)}
                          placeholder={`Search the ${getTeamAbbreviation(tradeTeamId)} system (40-man and minors)...`}
                          aria-label="Search players in the selected team's system"
                          style={{ ...createFieldStyle, width: "100%", fontSize: "0.88rem" }}
                        />
                        <div style={{ display: "grid", gap: "0.35rem", maxHeight: "360px", overflowY: "auto" }}>
                          {tradeTeamPlayers === "loading" || tradeTeamPlayers === undefined ? (
                            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
                              Loading the {getTeamAbbreviation(tradeTeamId)} system…
                            </p>
                          ) : tradeTeamPlayers === "error" ? (
                            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
                              Couldn&apos;t load that system — try again later.
                            </p>
                          ) : tradeTeamResults.length === 0 ? (
                            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>No matching players.</p>
                          ) : (
                            tradeTeamResults.map((player) => (
                              <TradeResultRow
                                key={player.id}
                                player={player}
                                blockedLabel={
                                  orgSystemIds.has(player.id)
                                    ? `On ${teamAbbreviation}`
                                    : tradeIncoming.some((piece) => piece.id === player.id)
                                      ? "In trade"
                                      : undefined
                                }
                                onAdd={() => addToTrade(player)}
                              />
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={completeTrade}
                    disabled={!tradeHasPieces}
                    style={{
                      ...smallButtonStyle,
                      background: "var(--accent)",
                      borderColor: "var(--accent)",
                      color: "#fff",
                      padding: "0.45rem 1rem",
                      opacity: tradeHasPieces ? 1 : 0.5,
                    }}
                  >
                    Complete trade ({tradeOutgoing.length} for {tradeIncoming.length})
                  </button>
                  {tradeHasPieces && (
                    <button type="button" onClick={cancelTrade} style={smallButtonStyle}>
                      Clear
                    </button>
                  )}
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", flex: "1 1 240px" }}>
                    Add as many players as you like to each side. Incoming 40-man players join the 40-man with their
                    current contracts; minor leaguers join the system.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={addQuery}
                onChange={(event) => setAddQuery(event.target.value)}
                placeholder={
                  addTab === "free-agents"
                    ? `Search ${FREE_AGENTS.length} impending free agents...`
                    : `Search ${team.shortName} minor leaguers to call up...`
                }
                style={{
                  width: "100%",
                  padding: "0.65rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid var(--line)",
                  background: "var(--bg-soft)",
                  color: "var(--text)",
                  fontSize: "0.95rem",
                }}
              />

              {addTab === "free-agents" ? (
                <>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    {FREE_AGENT_FILTERS.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setFreeAgentFilter(filter)}
                        style={{ ...addTabButtonStyle(freeAgentFilter === filter), padding: "0.25rem 0.7rem", fontSize: "0.78rem" }}
                      >
                        {filter === "all" ? "All" : filter}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gap: "0.5rem", maxHeight: "520px", overflowY: "auto" }}>
                    {freeAgentPool.length === 0 ? (
                      <p style={{ margin: 0, color: "var(--muted)" }}>No matching free agents found.</p>
                    ) : (
                      freeAgentPool.map((freeAgent) => (
                        <div
                          key={freeAgent.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "0.4rem 0.65rem",
                            padding: "0.5rem 0.7rem",
                            borderRadius: "12px",
                            border: "1px solid var(--line)",
                            background: "rgba(15,31,61,0.02)",
                          }}
                        >
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              overflow: "hidden",
                              flexShrink: 0,
                              background: "rgba(15,31,61,.08)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            <PlayerHeadshot
                              src={playerHeadshotUrl(freeAgent.id, 68)}
                              alt={freeAgent.fullName}
                              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                            />
                          </div>
                          <div style={{ display: "grid", gap: "0.1rem", minWidth: 0, flex: "1 1 220px" }}>
                            <span style={{ fontSize: "0.9rem" }}>
                              <span style={{ fontWeight: 700 }}>
                                <PlayerName player={freeAgent} showThrows />
                              </span>
                              <span style={{ color: "var(--muted)", marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                                {freeAgent.groups.join("/")} · Age {freeAgent.age} in {CONTRACT_SEASON} ·{" "}
                                {getTeamAbbreviation(freeAgent.teamId)}
                              </span>
                            </span>
                            {freeAgent.note && (
                              <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{freeAgent.note}</span>
                            )}
                          </div>
                          <div style={{ marginLeft: "auto" }}>
                            <SignForm submitLabel="Sign" onSign={(signing) => signFreeAgent(freeAgent, signing)} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {addPool.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--muted)" }}>No matching players found.</p>
                  ) : (
                    addPool.map((player) => (
                      <div
                        key={player.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.65rem",
                          padding: "0.5rem 0.7rem",
                          borderRadius: "12px",
                          border: "1px solid var(--line)",
                          background: "rgba(15,31,61,0.02)",
                        }}
                      >
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            overflow: "hidden",
                            flexShrink: 0,
                            background: "rgba(15,31,61,.08)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <PlayerHeadshot
                            src={playerHeadshotUrl(player.id, 68)}
                            alt={player.fullName}
                            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                          />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                          <PlayerName player={player} />
                        </span>
                        {player.level && <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{player.level}</span>}
                        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }} title={handTitle(player)}>
                          {positionLabel(player)}
                        </span>
                        <button
                          type="button"
                          onClick={() => selectContract(player)}
                          style={{
                            marginLeft: "auto",
                            border: "1px solid var(--line)",
                            background: "var(--panel)",
                            color: "var(--text)",
                            fontWeight: 700,
                            borderRadius: "999px",
                            padding: "0.35rem 0.8rem",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                          }}
                        >
                          Select
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <p className="kicker" style={{ marginBottom: "0.6rem" }}>
          Transactions
        </p>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "18px",
            background: "var(--panel)",
            padding: "1.15rem",
            display: "grid",
            gap: "0.6rem",
          }}
        >
          {transactions.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No moves yet. Trades, signings, selected contracts, IL activations, and players removed from the 40-man
              show up here and can be undone.
            </p>
          ) : (
            transactions.map((transaction) => {
              const blockedReason = undoBlockedReason(transaction);

              return (
                <div
                  key={transaction.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    columnGap: "0.75rem",
                    rowGap: "0.15rem",
                    paddingBottom: "0.6rem",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <span style={{ fontSize: "0.9rem" }}>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        color: TRANSACTION_LABELS[transaction.kind].color,
                        marginRight: "0.5rem",
                      }}
                    >
                      {TRANSACTION_LABELS[transaction.kind].label}
                    </span>
                    <strong>{transaction.summary}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => undoTransaction(transaction)}
                    disabled={!!blockedReason}
                    title={blockedReason ?? `Undo: ${transaction.summary}`}
                    style={{
                      ...smallButtonStyle,
                      gridRow: "span 2",
                      opacity: blockedReason ? 0.45 : 1,
                      cursor: blockedReason ? "not-allowed" : "pointer",
                    }}
                  >
                    Undo
                  </button>
                  {transaction.detail && (
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{transaction.detail}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setPayrollOpen((open) => !open)}
          aria-expanded={payrollOpen}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.9rem 1.15rem",
            border: "1px solid var(--line)",
            borderRadius: payrollOpen ? "18px 18px 0 0" : "18px",
            background: "var(--panel)",
            color: "var(--text)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span className="kicker" style={{ margin: 0 }}>
            {CONTRACT_SEASON} Payroll &amp; Contracts
          </span>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#8a5a00",
              background: "rgba(138,90,0,0.1)",
              borderRadius: "999px",
              padding: "0.15rem 0.5rem",
            }}
          >
            Estimated
          </span>
          <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: "1.05rem" }}>
            {formatSalary(payroll.total)}
            <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: "0.78rem", marginLeft: "0.3rem" }}>est.</span>
          </span>
          <span
            aria-hidden="true"
            style={{ transition: "transform 0.15s", transform: payrollOpen ? "rotate(180deg)" : "none", color: "var(--muted)" }}
          >
            ▾
          </span>
        </button>

        {payrollOpen && (
          <div
            style={{
              border: "1px solid var(--line)",
              borderTop: "none",
              borderRadius: "0 0 18px 18px",
              background: "var(--panel)",
              padding: "1.15rem",
              display: "grid",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
              {[
                { label: "Estimated payroll", value: payroll.total, strong: true },
                { label: "Signed / options", value: payroll.totals.guaranteed },
                { label: "Arbitration (proj.)", value: payroll.totals.arbitration },
                { label: "Pre-arb (est.)", value: payroll.totals.preArb },
                ...(payroll.totals.deadMoney !== 0 ? [{ label: "Dead money & other", value: payroll.totals.deadMoney }] : []),
                ...(payroll.deferred > 0 ? [{ label: "Deferred (paid later)", value: payroll.deferred }] : []),
              ].map((item) => (
                <div key={item.label}>
                  <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                    {item.label}
                  </p>
                  <p style={{ margin: 0, fontSize: item.strong ? "1.4rem" : "1.1rem", fontWeight: 800 }}>
                    {formatSalary(item.value)}
                  </p>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gap: "0.6rem",
                padding: "0.85rem 1rem",
                borderRadius: "14px",
                border: "1px solid var(--line)",
                background: payroll.luxuryTax.tier > 0 ? "rgba(180,35,24,0.05)" : "rgba(15,122,56,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                  Luxury tax (CBT) · est.
                </p>
                <select
                  value={payorStatus}
                  onChange={(event) => setPayorStatus(event.target.value as PayorStatus)}
                  aria-label="Luxury tax payor status"
                  style={{ ...contractFieldStyle, marginLeft: "auto", width: "auto", fontWeight: 700 }}
                >
                  {(Object.keys(PAYOR_STATUS_LABELS) as PayorStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {PAYOR_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
                {[
                  { label: "Tax payroll", value: formatSalary(payroll.taxPayroll) },
                  { label: "Threshold", value: formatSalary(TAX_THRESHOLDS[0]) },
                  {
                    label: payroll.luxuryTax.tier > 0 ? `Over (tier ${payroll.luxuryTax.tier})` : "Room under",
                    value: formatSalary(Math.abs(payroll.taxPayroll - TAX_THRESHOLDS[0])),
                    color: payroll.luxuryTax.tier > 0 ? "#b42318" : "#0f7a38",
                  },
                  { label: "Estimated tax", value: formatSalary(payroll.luxuryTax.tax) },
                ].map((item) => (
                  <div key={item.label}>
                    <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                      {item.label}
                    </p>
                    <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Tax payroll against the base threshold and the three surcharge tiers. */}
              {(() => {
                const scaleMax = Math.max(TAX_THRESHOLDS[3] * 1.08, payroll.taxPayroll * 1.04);
                const percent = (amount: number) => `${Math.min(100, (amount / scaleMax) * 100)}%`;
                return (
                  <div style={{ position: "relative", height: "34px" }} aria-hidden="true">
                    <div
                      style={{
                        position: "absolute",
                        top: "6px",
                        left: 0,
                        right: 0,
                        height: "10px",
                        borderRadius: "999px",
                        background: "var(--line)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "6px",
                        left: 0,
                        width: percent(payroll.taxPayroll),
                        height: "10px",
                        borderRadius: "999px",
                        background: payroll.luxuryTax.tier > 0 ? "#b42318" : "#0f7a38",
                      }}
                    />
                    {TAX_THRESHOLDS.map((threshold) => (
                      <div key={threshold} style={{ position: "absolute", top: 0, left: percent(threshold) }}>
                        <div style={{ width: "2px", height: "22px", background: "var(--text)", opacity: 0.55 }} />
                        <span
                          style={{
                            position: "absolute",
                            top: "21px",
                            transform: "translateX(-50%)",
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            color: "var(--muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatSalary(threshold)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.74rem" }}>
                Tax payroll counts each contract at its AAV (deferred money at present value, ~
                {Math.round(DEFERRAL_DISCOUNT_RATE * 1000) / 10}% discount), arbitration and pre-arb salaries, money owed to
                former players{payroll.taxAdjustments.length > 0 ? ", FanGraphs' tax adjustments" : ""}, and an estimated{" "}
                {formatSalary(PLAYER_BENEFITS_ESTIMATE)} in player benefits, plus the club&apos;s{" "}
                {formatSalary(PRE_ARB_BONUS_POOL_SHARE)} share of the pre-arb bonus pool. Uses the 2026 thresholds and rates until the next
                CBA sets 2027&apos;s. Going $40M+ over also moves a club&apos;s top draft pick back 10 spots.
              </p>
            </div>

            <div style={{ display: "grid", gap: "0.35rem" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
                Guaranteed commitments in later seasons
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
                {payroll.future.map(({ season, committed }) => (
                  <div key={season}>
                    <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)" }}>{season}</p>
                    <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{formatSalary(committed)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "0.72rem", textTransform: "uppercase" }}>
                    <th style={{ padding: "0.4rem 0.5rem" }}>Player</th>
                    <th style={{ padding: "0.4rem 0.5rem" }}>Status</th>
                    <th style={{ padding: "0.4rem 0.5rem", textAlign: "right" }}>{CONTRACT_SEASON} (est.)</th>
                    <th style={{ padding: "0.4rem 0.5rem" }}>Contract</th>
                    <th style={{ padding: "0.4rem 0.5rem" }}>FA After</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.rows.map(({ player, contract, salary, inMinors }) => {
                    return (
                      <tr key={player.id} style={{ borderTop: "1px solid var(--line)" }}>
                        <td style={{ padding: "0.4rem 0.5rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {player.fullName}
                          <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: "0.4rem" }}>
                            {player.position}
                            {reserveIL.some((p) => p.id === player.id) && " · 60-day IL"}
                          </span>
                        </td>
                        <td style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>
                          {contract ? CONTRACT_STATUS_LABELS[contract.status] : "Unknown"}
                          {inMinors && (
                            <span
                              style={{ display: "block", fontSize: "0.7rem", color: "var(--muted)" }}
                              title="Not on the 26-man, so paid the minor league 40-man salary"
                            >
                              In minors · 40-man
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {contract ? formatSalary(salary) : "—"}
                          {contract?.deferred ? (
                            <span style={{ display: "block", fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600 }}>
                              {formatSalary(contract.deferred)} deferred
                            </span>
                          ) : null}
                        </td>
                        <td style={{ padding: "0.4rem 0.5rem", color: "var(--muted)" }}>
                          <span title={contract?.deferralNote}>
                            {contract?.detail ?? "—"}
                            {contract?.deferralNote && !contract.deferred && " · has deferrals"}
                          </span>
                        </td>
                        <td
                          style={{ padding: "0.4rem 0.5rem", color: "var(--muted)", whiteSpace: "nowrap" }}
                          title={
                            contract?.freeAgentEstimated
                              ? "Earliest possible year, estimated from MLB debut date — any time in the minors pushes it later"
                              : undefined
                          }
                        >
                          {formatFreeAgentAfter(contract)}
                        </td>
                      </tr>
                    );
                  })}
                  {(payroll.currentOtherPayments.length > 0 || deadMoney.length > 0 || payroll.tradeCash.length > 0) && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "0.9rem 0.5rem 0.3rem",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        Dead money &amp; other payments
                      </td>
                    </tr>
                  )}
                  {payroll.currentOtherPayments.map((payment) => (
                    <tr key={`${payment.description}-${payment.amount}`} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: 700 }} colSpan={2}>
                        {payment.description.charAt(0).toUpperCase() + payment.description.slice(1)}
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: 700 }}>
                        {formatSalary(payment.amount)}
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "var(--muted)" }} colSpan={2}>
                        {payment.amount < 0 ? `Owed to the ${team.shortName}` : "No longer on the roster"}
                      </td>
                    </tr>
                  ))}
                  {payroll.tradeCash.map((entry) => (
                    <tr key={`cash-${entry.id}`} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: 700 }} colSpan={2}>
                        {entry.description}
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: 700 }}>
                        {formatSalary(entry.amount)}
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "var(--muted)" }} colSpan={2}>
                        {entry.amount < 0 ? "Received in a trade" : "Sent in a trade"} ({CONTRACT_SEASON})
                      </td>
                    </tr>
                  ))}
                  {deadMoney.map((entry) => (
                    <tr key={`dead-${entry.player.id}`} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "0.4rem 0.5rem", fontWeight: 700 }} colSpan={2}>
                        {entry.player.fullName} ({entry.reason})
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: 700 }}>
                        {formatSalary(entry.amount)}
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem", color: "var(--muted)" }} colSpan={2}>
                        {entry.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.78rem" }}>
              All salary figures are estimates. Contracts, options and dead money come from FanGraphs RosterResource for
              every club (so players acquired in trades bring their real salaries), and arbitration figures are MLB
              Trade Rumors projections — both as of {CONTRACTS_UPDATED}. Pre-arb players on the 26-man earn their{" "}
              {CONTRACT_SEASON - 1} salary or the {formatSalary(PRE_ARB_SALARY_ESTIMATE)} minimum, whichever is more;
              pre-arb 40-man players in the minors earn the minor league 40-man salary (
              {formatSalary(MINOR_LEAGUE_SALARY_FIRST_CONTRACT)} on a first major league contract,{" "}
              {formatSalary(MINOR_LEAGUE_SALARY)} after; {CONTRACT_SEASON - 1} CBA figures). Until all 26 spots are set,
              the open spots are assumed to go to the most experienced unassigned 40-man players. Pre-arb free-agency years come from FanGraphs where listed; years
              marked &ldquo;est.&rdquo; are the earliest possible, based on MLB debut date. Includes the 40-man, the
              60-day IL, and money still owed to players no longer on the roster (cash sent in trades, buyouts).
              Removing a player from the 40-man declines a club or mutual option (the salary comes off, but any buyout stays
              on as dead money) or non-tenders an arbitration/pre-arb player (off the payroll); anyone else is designated
              for assignment, and a guaranteed deal stays on as dead money.
              Players traded away take their full contracts with them; cash added to a builder trade counts toward{" "}
              {CONTRACT_SEASON} (sent adds to payroll, received offsets it). Later-season commitments only include guaranteed
              money (multi-year deals, builder signings, and dead money).
              {payroll.totals.unknownCount > 0 &&
                ` ${payroll.totals.unknownCount} player${payroll.totals.unknownCount === 1 ? " has" : "s have"} no contract set and ${payroll.totals.unknownCount === 1 ? "isn't" : "aren't"} counted.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
