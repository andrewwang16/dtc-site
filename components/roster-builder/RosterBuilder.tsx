"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  CARDINALS_TEAM_ID,
  getTeamAbbreviation,
  playerHeadshotUrl,
  stripDiacritics,
  type RosterEntry,
  type ExternalPlayer,
} from "@/lib/mlb";
import PlayerHeadshot from "@/components/shared/PlayerHeadshot";
import type { ProspectPlayer } from "@/lib/prospects";
import {
  CONTRACT_SEASON,
  formatSalary,
  getContract,
  signedContract,
  structuredSalaries,
  type ContractInfo,
  type SalaryStructure,
  type Signing,
} from "@/lib/contracts";
import { FREE_AGENTS, type FreeAgent, type FreeAgentGroup } from "@/lib/free-agents";

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
const BULLPEN_SLOTS: SlotDef[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `RP${n}`, label: `RP${n}`, group: "bullpen" }));

const ALL_SLOTS: SlotDef[] = [...DIAMOND_SLOTS, ...BENCH_SLOTS, ...ROTATION_SLOTS, ...BULLPEN_SLOTS];
const TOTAL_SLOTS = ALL_SLOTS.length;
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
type AddTab = "prospects" | "free-agents" | "trades" | "create";

type TransactionKind = "trade" | "signing" | "option" | "non-tender" | "dfa";

const TRANSACTION_LABELS: Record<TransactionKind, { label: string; color: string }> = {
  trade: { label: "Trade", color: "var(--accent)" },
  signing: { label: "Signing", color: "#0f7a38" },
  option: { label: "Option declined", color: "#8a5a00" },
  "non-tender": { label: "Non-tender", color: "#8a5a00" },
  dfa: { label: "DFA", color: "#5b3fa0" },
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
};

const LINEUP_SPOTS = 9;

// Seasons after CONTRACT_SEASON shown as future payroll commitments.
const FUTURE_COMMITMENT_SEASONS = 4;
type FreeAgentFilter = "all" | FreeAgentGroup;

const FREE_AGENT_FILTERS: FreeAgentFilter[] = ["all", "C", "1B", "2B", "SS", "3B", "LF", "CF", "RF", "DH", "SP", "RP"];
const FREE_AGENT_IDS = new Set(FREE_AGENTS.map((player) => player.id));
const MAX_CONTRACT_YEARS = 15;

const CREATE_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

const CONTRACT_STATUS_LABELS: Record<ContractInfo["status"], string> = {
  guaranteed: "Signed",
  signed: "New deal",
  "club-option": "Club option",
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

const HAND_NAMES: Record<string, string> = { L: "left", R: "right", S: "switch" };

// Position plus handedness: throwing hand for pitchers ("RHP"), batting
// side for everyone else ("CF · L").
function positionWithHand(player: { position: string; bats?: string; throws?: string }) {
  if (player.position === "P") {
    return player.throws ? `${player.throws}HP` : "P";
  }

  return player.bats ? `${player.position} · ${player.bats}` : player.position;
}

function handTitle(player: { position: string; bats?: string; throws?: string }) {
  if (player.position === "P") {
    return player.throws ? `Throws ${HAND_NAMES[player.throws] ?? player.throws}` : undefined;
  }

  return player.bats ? `Bats ${HAND_NAMES[player.bats] ?? player.bats}` : undefined;
}

// What dropping a player from the 40-man means for their contract.
function removalKind(contract: ContractInfo | null): "option" | "non-tender" | "dfa" {
  if (contract?.status === "club-option") {
    return "option";
  }

  if (contract?.status === "arbitration" || contract?.status === "pre-arb") {
    return "non-tender";
  }

  return "dfa";
}

const REMOVAL_ACTIONS: Record<"option" | "non-tender" | "dfa", string> = {
  option: "Decline option",
  "non-tender": "Non-tender",
  dfa: "Designate for assignment",
};

function parseMillions(text: string): number | null {
  const millions = Number(text);
  return text.trim() && Number.isFinite(millions) && millions > 0 ? Math.round(millions * 1_000_000) : null;
}

function parseYears(text: string): number | null {
  const years = Number(text);
  return Number.isInteger(years) && years >= 1 && years <= MAX_CONTRACT_YEARS ? years : null;
}

// Salary is entered in millions per year (AAV). Returns null until both
// fields hold a usable deal; the salary is the same every season.
function parseSigning(salaryText: string, yearsText: string): Signing | null {
  const aav = parseMillions(salaryText);
  const years = parseYears(yearsText);
  return aav !== null && years !== null ? { salaries: structuredSalaries(aav, years, "even") } : null;
}

type StructureChoice = SalaryStructure | "custom";

const STRUCTURE_LABELS: Record<StructureChoice, string> = {
  even: "Same each year",
  front: "Front-loaded",
  back: "Back-loaded",
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

// Salary ($M per year) + years, used to sign a free agent or set a
// contract on a created or traded-for player. A multi-year deal can
// optionally be structured (front-/back-loaded, or set season by season);
// left alone, every season pays the same AAV.
function SignForm({
  submitLabel,
  initial,
  onSign,
}: {
  submitLabel: string;
  initial?: Signing;
  onSign: (signing: Signing) => void;
}) {
  const initialEven = initial ? initial.salaries.every((salary) => salary === initial.salaries[0]) : true;
  const initialAav = initial ? initial.salaries.reduce((sum, salary) => sum + salary, 0) / initial.salaries.length : 0;

  const [salary, setSalary] = useState(initial ? String(Math.round(initialAav / 100_000) / 10) : "");
  const [years, setYears] = useState(initial ? String(initial.salaries.length) : "1");
  const [structure, setStructure] = useState<StructureChoice>(initialEven ? "even" : "custom");
  const [customSalaries, setCustomSalaries] = useState<string[]>(
    initial && !initialEven ? initial.salaries.map((amount) => String(amount / 1_000_000)) : []
  );

  const yearCount = parseYears(years);
  const aav = parseMillions(salary);

  let salaries: number[] | null = null;
  if (yearCount !== null) {
    if (structure === "custom") {
      // A blank season falls back to the AAV.
      const perSeason = Array.from({ length: yearCount }, (_, index) => parseMillions(customSalaries[index] ?? "") ?? aav);
      salaries = perSeason.every((amount): amount is number => amount !== null) ? perSeason : null;
    } else if (aav !== null) {
      salaries = structuredSalaries(aav, yearCount, structure);
    }
  }

  const total = salaries?.reduce((sum, amount) => sum + amount, 0) ?? 0;
  const showStructure = yearCount !== null && yearCount > 1;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (salaries) {
          onSign({ salaries });
        }
      }}
      style={{ display: "grid", gap: "0.35rem", justifyItems: "end" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <input
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          value={salary}
          onChange={(event) => setSalary(event.target.value)}
          placeholder="$M / yr"
          aria-label="Salary in millions per year"
          style={{ ...contractFieldStyle, width: "6.5rem" }}
        />
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
        {showStructure && (
          <select
            value={structure}
            onChange={(event) => setStructure(event.target.value as StructureChoice)}
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
        <button type="submit" disabled={!salaries} style={{ ...smallButtonStyle, opacity: salaries ? 1 : 0.5 }}>
          {submitLabel}
        </button>
      </div>

      {showStructure && structure === "custom" && yearCount !== null && (
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {Array.from({ length: yearCount }, (_, index) => (
            <label key={index} style={{ display: "grid", gap: "0.1rem", fontSize: "0.68rem", color: "var(--muted)" }}>
              {CONTRACT_SEASON + index}
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
                placeholder={aav !== null ? String(aav / 1_000_000) : "$M"}
                aria-label={`${CONTRACT_SEASON + index} salary in millions`}
                style={{ ...contractFieldStyle, width: "4.6rem" }}
              />
            </label>
          ))}
        </div>
      )}

      {showStructure && salaries && structure !== "even" && (
        <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
          {salaries.map((amount) => formatSalary(amount)).join(" / ")} · {formatSalary(total)} total
        </span>
      )}
    </form>
  );
}

function isPitcherSlot(group: SlotGroup) {
  return group === "rotation" || group === "bullpen";
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
                  <span style={{ fontWeight: 700 }}>{eligible.fullName}</span>
                  <span style={{ color: "var(--muted)", marginLeft: "auto" }} title={handTitle(eligible)}>
                    {positionWithHand(eligible)}
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

export default function RosterBuilder({
  roster,
  prospects,
  externalPlayers,
  sixtyDayIL,
}: {
  roster: RosterEntry[];
  prospects: ProspectPlayer[];
  externalPlayers: ExternalPlayer[];
  sixtyDayIL: RosterEntry[];
}) {
  const [fortyMan, setFortyMan] = useState<SimplePlayer[]>(roster);
  const [reserveIL, setReserveIL] = useState<SimplePlayer[]>(sixtyDayIL);
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  const [positionView, setPositionView] = useState<"defense" | "lineup">("defense");
  // Batting order by player id; only players currently in the defensive
  // alignment count (see lineup below).
  const [battingOrder, setBattingOrder] = useState<Array<number | null>>(() => Array(LINEUP_SPOTS).fill(null));
  const [addTab, setAddTab] = useState<AddTab>("prospects");
  const [addQuery, setAddQuery] = useState("");
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [slotQuery, setSlotQuery] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createPosition, setCreatePosition] = useState(CREATE_POSITIONS[0]);
  const [createSalary, setCreateSalary] = useState("");
  const [createYears, setCreateYears] = useState("1");
  const [freeAgentFilter, setFreeAgentFilter] = useState<FreeAgentFilter>("all");
  // Deals made in the builder, keyed by player id. These override any
  // real contract data for that player.
  const [signings, setSignings] = useState<Record<number, Signing>>({});
  const [editingContractId, setEditingContractId] = useState<number | null>(null);
  const [payrollOpen, setPayrollOpen] = useState(false);
  // An in-progress trade: the player coming back and who's being sent out.
  const [tradeIncomingIds, setTradeIncomingIds] = useState<number[]>([]);
  const [tradeOutgoingIds, setTradeOutgoingIds] = useState<number[]>([]);
  const [tradeQuery, setTradeQuery] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const nextTransactionId = useRef(1);
  // Created players get negative ids so they can never collide with a
  // real MLB player id.
  const nextCreatedId = useRef(-1);

  // Players who started in the organization (40-man, 60-day IL, or the
  // minors). Anyone here without a listed contract is treated as pre-arb.
  const organizationalIds = useMemo(
    () => new Set([...roster, ...sixtyDayIL, ...prospects].map((player) => player.id)),
    [roster, sixtyDayIL, prospects]
  );

  const contractFor = useCallback(
    (player: SimplePlayer) => {
      const signing = signings[player.id];
      return signing ? signedContract(signing) : getContract(player, organizationalIds.has(player.id));
    },
    [signings, organizationalIds]
  );

  // Players designated for assignment whose deals are guaranteed (real
  // multi-year contracts and builder signings) — that money is still owed.
  const deadMoneyContracts = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.kind === "dfa")
        .flatMap((transaction) => transaction.outgoing)
        .map((player) => ({ player, contract: contractFor(player) }))
        .filter(({ contract }) => contract?.status === "guaranteed" || contract?.status === "signed"),
    [transactions, contractFor]
  );

  // Everyone on the 40-man or the 60-day IL is paid. Non-tendered players
  // and declined options cost nothing; DFA'd guaranteed deals are dead money.
  const payroll = useMemo(() => {
    const paidPlayers = [...fortyMan, ...reserveIL];
    const rows = paidPlayers
      .map((player) => ({ player, contract: contractFor(player) }))
      .sort((a, b) => (b.contract?.salary ?? -1) - (a.contract?.salary ?? -1));

    const totals = { guaranteed: 0, arbitration: 0, preArb: 0, deadMoney: 0, unknownCount: 0 };

    for (const { contract } of rows) {
      if (!contract) {
        totals.unknownCount += 1;
      } else if (contract.status === "arbitration") {
        totals.arbitration += contract.salary;
      } else if (contract.status === "pre-arb") {
        totals.preArb += contract.salary;
      } else {
        totals.guaranteed += contract.salary;
      }
    }

    for (const { contract } of deadMoneyContracts) {
      totals.deadMoney += contract?.salary ?? 0;
    }

    const total = totals.guaranteed + totals.arbitration + totals.preArb + totals.deadMoney;

    // Later seasons only count money that's actually guaranteed (real
    // multi-year deals and builder signings, including dead money) —
    // arbitration and pre-arb salaries past next season aren't projected.
    const future = Array.from({ length: FUTURE_COMMITMENT_SEASONS }, (_, index) => {
      const season = CONTRACT_SEASON + 1 + index;
      const committed = [...rows, ...deadMoneyContracts].reduce(
        (sum, { contract }) => sum + (contract?.salaryBySeason?.[season] ?? 0),
        0
      );
      return { season, committed };
    });

    return { rows, totals, total, future };
  }, [fortyMan, reserveIL, deadMoneyContracts, contractFor]);

  const fortyManIds = useMemo(() => new Set(fortyMan.map((player) => player.id)), [fortyMan]);
  const externalById = useMemo(() => new Map(externalPlayers.map((player) => [player.id, player])), [externalPlayers]);
  const fortyManById = useMemo(() => new Map(fortyMan.map((player) => [player.id, player])), [fortyMan]);

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter((id): id is number => id !== null && id !== undefined)),
    [assignments]
  );
  const filledCount = assignedIds.size;

  const addPool = useMemo((): SimplePlayer[] => {
    const trimmed = stripDiacritics(addQuery.trim().toLowerCase());
    const matches = (player: SimplePlayer) =>
      !fortyManIds.has(player.id) && (!trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed));

    if (addTab === "prospects") {
      return prospects.filter(matches).slice(0, 8);
    }

    // Trade targets: players under contract with other clubs, so impending
    // free agents (on their own tab) and Cardinals are left out.
    if (addTab === "trades") {
      return trimmed
        ? externalPlayers
            .filter((player) => player.teamId !== CARDINALS_TEAM_ID && !FREE_AGENT_IDS.has(player.id))
            .filter(matches)
            .slice(0, 8)
        : [];
    }

    return [];
  }, [addTab, addQuery, prospects, externalPlayers, fortyManIds]);

  const freeAgentPool = useMemo(() => {
    const trimmed = stripDiacritics(addQuery.trim().toLowerCase());

    return FREE_AGENTS.filter((player) => !fortyManIds.has(player.id))
      .filter((player) => freeAgentFilter === "all" || player.groups.includes(freeAgentFilter))
      .filter((player) => !trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed));
  }, [addQuery, freeAgentFilter, fortyManIds]);

  const openSlotDef = ALL_SLOTS.find((slot) => slot.id === openSlotId) ?? null;

  const slotEligiblePlayers = useMemo(() => {
    if (!openSlotDef) {
      return [];
    }

    const wantsPitcher = isPitcherSlot(openSlotDef.group);
    const trimmed = stripDiacritics(slotQuery.trim().toLowerCase());

    return fortyMan
      .filter((player) => (player.position === "P") === wantsPitcher)
      .filter((player) => !assignedIds.has(player.id))
      .filter((player) => !trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed))
      .slice(0, 8);
  }, [openSlotDef, fortyMan, assignedIds, slotQuery]);

  // Created players have negative ids, so slot lookups can't use a
  // sentinel id for "empty" — check for an assignment explicitly.
  function playerInSlot(slotId: string) {
    const playerId = assignments[slotId];
    return playerId == null ? null : fortyManById.get(playerId) ?? null;
  }

  // The lineup draws from whoever is in the defensive alignment right now.
  const starters = DIAMOND_SLOTS.flatMap((slot) => {
    const player = playerInSlot(slot.id);
    return player ? [{ slot, player }] : [];
  });
  const starterById = new Map(starters.map((starter) => [starter.player.id, starter]));
  const lineup = battingOrder.map((id) => (id !== null && starterById.has(id) ? id : null));
  const lineupFilled = lineup.filter((id) => id !== null).length;
  const startersOutOfLineup = starters.filter((starter) => !lineup.includes(starter.player.id));

  function setLineupSpot(index: number, playerId: number | null) {
    setBattingOrder(() => {
      const next = lineup.map((id) => (id === playerId ? null : id));
      next[index] = playerId;
      return next;
    });
  }

  function swapLineupSpots(from: number, to: number) {
    setBattingOrder(() => {
      const next = [...lineup];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }

  function fillLineupFromDefense() {
    setBattingOrder(() => {
      const next = [...lineup];
      const remaining = startersOutOfLineup.map((starter) => starter.player.id);
      for (let index = 0; index < next.length && remaining.length > 0; index += 1) {
        if (next[index] === null) {
          next[index] = remaining.shift() ?? null;
        }
      }
      return next;
    });
  }

  function clearSlot(slot: SlotDef) {
    const playerId = assignments[slot.id];
    if (playerId != null) {
      unassignPlayer(playerId);
    }
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

  function assignPlayerToSlot(slot: SlotDef, playerId: number) {
    setAssignments((current) => {
      const next = { ...current };
      for (const slotId of Object.keys(next)) {
        if (next[slotId] === playerId) {
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

    if (!player || (player.position === "P") !== isPitcherSlot(slot.group)) {
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

  // Adds a player to the incoming side of the trade being built (starting
  // one if none is open).
  function addToTrade(player: SimplePlayer) {
    if (!externalById.has(player.id)) {
      return;
    }
    setTradeIncomingIds((current) => (current.includes(player.id) ? current : [...current, player.id]));
  }

  function cancelTrade() {
    setTradeIncomingIds([]);
    setTradeOutgoingIds([]);
    setTradeQuery("");
  }

  const tradeIncoming = tradeIncomingIds
    .map((id) => externalById.get(id))
    .filter((player): player is ExternalPlayer => player !== undefined);

  const tradeOutgoing = tradeOutgoingIds
    .map((id) => fortyManById.get(id))
    .filter((player): player is SimplePlayer => player !== undefined);

  const tradeCandidates = useMemo(() => {
    const trimmed = stripDiacritics(tradeQuery.trim().toLowerCase());
    return fortyMan
      .filter((player) => !tradeOutgoingIds.includes(player.id))
      .filter((player) => !trimmed || stripDiacritics(player.fullName.toLowerCase()).includes(trimmed))
      .slice(0, 8);
  }, [fortyMan, tradeOutgoingIds, tradeQuery]);

  function describePlayers(players: ExternalPlayer[]) {
    return players
      .map((player) => `${player.fullName} (${player.position}${player.teamId ? `, ${getTeamAbbreviation(player.teamId)}` : ""})`)
      .join(", ");
  }

  // The acquired players join the 40-man and everyone sent out leaves it
  // (no buyout or dead money — their contracts go with them).
  function completeTrade() {
    if (tradeIncoming.length === 0) {
      return;
    }

    const projected = fortyMan.length + tradeIncoming.length - tradeOutgoing.length;
    if (
      projected > FORTY_MAN_LIMIT &&
      !window.confirm(
        `This trade would put the 40-man roster at ${projected}, over the ${FORTY_MAN_LIMIT}-man limit. Make it anyway?`
      )
    ) {
      return;
    }

    const incoming = tradeIncoming.map(toSimplePlayer);
    const incomingIds = new Set(incoming.map((player) => player.id));
    const outgoingIds = new Set(tradeOutgoing.map((player) => player.id));
    const outgoingSalary = tradeOutgoing.reduce((sum, player) => sum + (contractFor(player)?.salary ?? 0), 0);

    setFortyMan((current) => [...current.filter((player) => !outgoingIds.has(player.id)), ...incoming]);
    for (const id of outgoingIds) {
      unassignPlayer(id);
    }

    logTransaction({
      kind: "trade",
      summary: `Acquired ${describePlayers(tradeIncoming)} for ${
        tradeOutgoing.length > 0 ? tradeOutgoing.map((player) => player.fullName).join(", ") : "nothing"
      }`,
      // Players without a known contract don't add anything here.
      detail: outgoingSalary > 0 ? `${formatSalary(outgoingSalary)} in ${CONTRACT_SEASON} salary sent out` : undefined,
      incoming,
      outgoing: tradeOutgoing.map(toSimplePlayer),
      signingsBefore: {},
    });

    cancelTrade();
  }

  // A move can be undone as long as nothing later has built on it: everyone
  // it brought in is still on the 40-man and nobody it sent out is back.
  function undoBlockedReason(transaction: Transaction): string | null {
    if (transaction.incoming.some((player) => !fortyManIds.has(player.id))) {
      return "A player from this move has since left the 40-man — undo that move first.";
    }
    if (transaction.outgoing.some((player) => fortyManIds.has(player.id))) {
      return "A player sent out in this move is back on the 40-man.";
    }
    return null;
  }

  function undoTransaction(transaction: Transaction) {
    if (undoBlockedReason(transaction)) {
      return;
    }

    const incomingIds = new Set(transaction.incoming.map((player) => player.id));

    setFortyMan((current) => [...current.filter((player) => !incomingIds.has(player.id)), ...transaction.outgoing]);
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

  // A created player's contract is optional, but if either contract field
  // is filled in, both have to make a valid deal.
  const createSigning = parseSigning(createSalary, createYears);
  const createHasContract = createSalary.trim() !== "";
  const canCreate = !!createFirstName.trim() && !!createLastName.trim() && (!createHasContract || !!createSigning);

  function createPlayer(event: React.FormEvent) {
    event.preventDefault();
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
      setCreateSalary("");
      setCreateYears("1");
    }
  }

  function activateFromIL(player: SimplePlayer) {
    if (addToFortyMan(player)) {
      setReserveIL((current) => current.filter((p) => p.id !== player.id));
    }
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
        kind === "option"
          ? `Declined ${player.fullName}'s club option`
          : kind === "non-tender"
            ? `Non-tendered ${player.fullName}`
            : `Designated ${player.fullName} for assignment`,
      detail:
        kind === "option" && contract
          ? `${formatSalary(contract.salary)} option comes off the payroll`
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

      <p style={{ margin: 0, color: "var(--muted)", fontWeight: 700 }}>
        {filledCount} / {TOTAL_SLOTS} roster spots filled
      </p>

      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "minmax(280px, 420px) 1fr" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
            <p className="kicker" style={{ margin: 0 }}>
              {positionView === "defense" ? "Position Players" : `Lineup (${lineupFilled} / ${LINEUP_SPOTS})`}
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
              {positionView === "defense" ? "LINEUP" : "DEFENSE"}
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
              {starters.length === 0 ? (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
                  Fill out the defense first — the lineup is built from the players in the field and at DH.
                </p>
              ) : (
                lineup.map((playerId, index) => {
                  const starter = playerId !== null ? starterById.get(playerId) : undefined;

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
                        const from = Number(event.dataTransfer.getData(LINEUP_SPOT_DRAG_TYPE));
                        if (event.dataTransfer.getData(LINEUP_SPOT_DRAG_TYPE) !== "" && from !== index) {
                          swapLineupSpots(from, index);
                        }
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.6rem 1fr auto auto",
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
                          <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{starter.player.fullName}</span>
                          <span style={{ fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                            {starter.slot.label}
                            {starter.player.bats ? ` · Bats ${starter.player.bats}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => setLineupSpot(index, null)}
                            aria-label={`Take ${starter.player.fullName} out of the ${index + 1} spot`}
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
                        </>
                      ) : (
                        <select
                          value=""
                          onChange={(event) => setLineupSpot(index, Number(event.target.value))}
                          disabled={startersOutOfLineup.length === 0}
                          aria-label={`Batting ${index + 1}`}
                          style={{ ...contractFieldStyle, gridColumn: "2 / span 3", width: "100%" }}
                        >
                          <option value="" disabled>
                            {startersOutOfLineup.length === 0 ? "Add more players to the defense" : "Choose a starter…"}
                          </option>
                          {startersOutOfLineup.map(({ slot, player }) => (
                            <option key={player.id} value={player.id}>
                              {player.fullName} — {slot.label}
                              {player.bats ? ` (${player.bats})` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })
              )}

              {starters.length > 0 && startersOutOfLineup.length > 0 && lineup.includes(null) && (
                <button type="button" onClick={fillLineupFromDefense} style={{ ...smallButtonStyle, justifySelf: "start" }}>
                  Fill from defense
                </button>
              )}
              {starters.length > 0 && (
                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>
                  Drag a hitter onto another spot to swap them.
                </p>
              )}
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
            {BULLPEN_SLOTS.map((slot) => (
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
            {BENCH_SLOTS.map((slot) => (
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
            fortyMan.map((player) => (
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
                {player.fullName}
                <span style={{ color: "var(--muted)", fontWeight: 400 }} title={handTitle(player)}>
                  {positionWithHand(player)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFromFortyMan(player.id)}
                  aria-label={`Remove ${player.fullName} from the 40-man roster`}
                  title={REMOVAL_ACTIONS[removalKind(contractFor(player))]}
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
          60-Day IL (Outside 40-Man)
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
            reserveIL.map((player) => (
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
                {player.fullName}
                <span style={{ color: "var(--muted)", fontWeight: 400 }} title={handTitle(player)}>
                  {positionWithHand(player)}
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
          <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: "1.05rem" }}>{formatSalary(payroll.total)}</span>
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
                { label: "Projected payroll", value: payroll.total, strong: true },
                { label: "Signed / options", value: payroll.totals.guaranteed },
                { label: "Arbitration (proj.)", value: payroll.totals.arbitration },
                { label: "Pre-arb (est.)", value: payroll.totals.preArb },
                ...(payroll.totals.deadMoney > 0 ? [{ label: "Dead money (DFA)", value: payroll.totals.deadMoney }] : []),
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
                    <th style={{ padding: "0.4rem 0.5rem", textAlign: "right" }}>{CONTRACT_SEASON}</th>
                    <th style={{ padding: "0.4rem 0.5rem" }}>Contract</th>
                    <th style={{ padding: "0.4rem 0.5rem" }}>FA After</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.rows.map(({ player, contract }) => {
                    // Only players without real contract data (or with a
                    // builder deal already) can have a contract set here.
                    const canSetContract = !contract || contract.status === "signed";
                    const isEditing = editingContractId === player.id;

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
                        </td>
                        <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: 700 }}>
                          {contract ? formatSalary(contract.salary) : "—"}
                        </td>
                        <td style={{ padding: "0.4rem 0.5rem", color: "var(--muted)" }}>
                          {isEditing ? (
                            <SignForm
                              submitLabel="Save"
                              initial={signings[player.id]}
                              onSign={(signing) => {
                                setSigning(player.id, signing);
                                setEditingContractId(null);
                              }}
                            />
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                              {contract?.detail ?? "—"}
                              {canSetContract && (
                                <button
                                  type="button"
                                  onClick={() => setEditingContractId(player.id)}
                                  style={{ ...smallButtonStyle, padding: "0.2rem 0.6rem", fontSize: "0.72rem" }}
                                >
                                  {contract ? "Edit" : "Set contract"}
                                </button>
                              )}
                            </span>
                          )}
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
                </tbody>
              </table>
            </div>

            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.78rem" }}>
              Includes the 40-man and 60-day IL. Arbitration figures are MLB Trade Rumors projections; pre-arb
              salaries use the {CONTRACT_SEASON - 1} league minimum. Pre-arb free-agency years come from FanGraphs
              where listed; years marked &ldquo;est.&rdquo; are the earliest possible, based on MLB debut date.
              Removing a player from the 40-man declines a club option or non-tenders an arbitration/pre-arb player (both
              come off the payroll); anyone else is designated for assignment, and a guaranteed deal stays on as dead money.
              Players traded away take their full contracts with them. Later-season commitments only include guaranteed
              money (multi-year deals, builder signings, and dead money).
              {payroll.totals.unknownCount > 0 &&
                ` ${payroll.totals.unknownCount} player${payroll.totals.unknownCount === 1 ? " has" : "s have"} no contract set and ${payroll.totals.unknownCount === 1 ? "isn't" : "aren't"} counted.`}
            </p>
          </div>
        )}
      </div>

      <div>
        <p className="kicker" style={{ marginBottom: "0.6rem" }}>
          Add to 40-Man Roster
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
              Prospects
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
            <form onSubmit={createPlayer} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
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
              <input
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={createSalary}
                onChange={(event) => setCreateSalary(event.target.value)}
                placeholder="$M / yr (optional)"
                aria-label="Salary in millions per year"
                style={{ ...createFieldStyle, flex: "1 1 150px" }}
              />
              <input
                type="number"
                min="1"
                max={MAX_CONTRACT_YEARS}
                step="1"
                inputMode="numeric"
                value={createYears}
                onChange={(event) => setCreateYears(event.target.value)}
                aria-label="Contract years"
                title="Contract years"
                style={{ ...createFieldStyle, flex: "0 0 5rem" }}
              />
              <button
                type="submit"
                disabled={!canCreate}
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--panel)",
                  color: "var(--text)",
                  fontWeight: 700,
                  borderRadius: "999px",
                  padding: "0.55rem 1rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  opacity: canCreate ? 1 : 0.5,
                }}
              >
                {createHasContract ? "Sign to 40-Man" : "Add to 40-Man"}
              </button>
            </form>
          ) : (
            <>
              <input
                type="text"
                value={addQuery}
                onChange={(event) => setAddQuery(event.target.value)}
                placeholder={
                  addTab === "trades"
                    ? "Search players on other MLB teams..."
                    : addTab === "free-agents"
                      ? `Search ${FREE_AGENTS.length} impending free agents...`
                      : "Search Cardinals prospects..."
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
                              <span style={{ fontWeight: 700 }}>{freeAgent.fullName}</span>
                              <span style={{ color: "var(--muted)", marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                                {freeAgent.groups.join("/")} ·{" "}
                                <span title={handTitle(freeAgent)}>
                                  {freeAgent.position === "P" ? `${freeAgent.throws}HP` : `Bats ${freeAgent.bats}`}
                                </span>{" "}
                                · Age {freeAgent.age} in {CONTRACT_SEASON} ·{" "}
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
                  {addTab === "trades" && tradeIncoming.length > 0 && (
                    <div
                      style={{
                        border: "2px solid var(--accent)",
                        borderRadius: "14px",
                        padding: "0.85rem",
                        display: "grid",
                        gap: "0.6rem",
                        background: "rgba(196,30,58,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <strong>Trade in progress</strong>
                        <button type="button" onClick={cancelTrade} style={{ ...smallButtonStyle, marginLeft: "auto" }}>
                          Cancel
                        </button>
                      </div>

                      <div style={{ display: "grid", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)" }}>
                          RECEIVING ({tradeIncoming.length})
                        </span>
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          {tradeIncoming.map((player) => (
                            <span
                              key={player.id}
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
                              {player.fullName}
                              <span style={{ color: "var(--muted)", fontWeight: 400 }} title={handTitle(player)}>
                                {positionWithHand(player)}
                                {player.teamId ? ` · ${getTeamAbbreviation(player.teamId)}` : ""}
                              </span>
                              <button
                                type="button"
                                onClick={() => setTradeIncomingIds((current) => current.filter((id) => id !== player.id))}
                                aria-label={`Take ${player.fullName} out of the trade`}
                                style={{
                                  width: "1.2rem",
                                  height: "1.2rem",
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
                          ))}
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          Search above and use &ldquo;Add to trade&rdquo; to bring back more players.
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)" }}>
                          SENDING OUT {tradeOutgoing.length > 0 ? `(${tradeOutgoing.length})` : ""}
                        </span>
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                          {tradeOutgoing.length === 0 ? (
                            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                              No one yet — pick players from the 40-man below.
                            </span>
                          ) : (
                            tradeOutgoing.map((player) => (
                              <span
                                key={player.id}
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
                                {player.fullName}
                                <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                                  {contractFor(player) ? formatSalary(contractFor(player)!.salary) : player.position}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setTradeOutgoingIds((current) => current.filter((id) => id !== player.id))}
                                  aria-label={`Keep ${player.fullName}`}
                                  style={{
                                    width: "1.2rem",
                                    height: "1.2rem",
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

                      <input
                        type="text"
                        value={tradeQuery}
                        onChange={(event) => setTradeQuery(event.target.value)}
                        placeholder="Add players to send out..."
                        aria-label="Search 40-man players to send out"
                        style={{ ...createFieldStyle, width: "100%" }}
                      />
                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                        {tradeCandidates.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => setTradeOutgoingIds((current) => [...current, player.id])}
                            style={smallButtonStyle}
                          >
                            + {player.fullName}{" "}
                            <span style={{ color: "var(--muted)", fontWeight: 400 }} title={handTitle(player)}>
                              {positionWithHand(player)}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={completeTrade}
                          style={{
                            ...smallButtonStyle,
                            background: "var(--accent)",
                            borderColor: "var(--accent)",
                            color: "#fff",
                            padding: "0.45rem 1rem",
                          }}
                        >
                          Complete trade
                        </button>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          Set incoming salaries from the payroll table after the trade.
                        </span>
                      </div>
                    </div>
                  )}

                  {addTab === "trades" && !addQuery.trim() ? (
                    <p style={{ margin: 0, color: "var(--muted)" }}>
                      Type a name to search players under contract with other teams, then pick who to send back.
                    </p>
                  ) : addPool.length === 0 ? (
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
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{player.fullName}</span>
                        {player.level && <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{player.level}</span>}
                        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }} title={handTitle(player)}>
                          {positionWithHand(player)}
                        </span>
                        <button
                          type="button"
                          onClick={() => (addTab === "trades" ? addToTrade(player) : addToFortyMan(player))}
                          disabled={addTab === "trades" && tradeIncomingIds.includes(player.id)}
                          style={{
                            opacity: addTab === "trades" && tradeIncomingIds.includes(player.id) ? 0.5 : 1,
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
                          {addTab !== "trades"
                            ? "Add"
                            : tradeIncomingIds.includes(player.id)
                              ? "In trade"
                              : tradeIncomingIds.length > 0
                                ? "Add to trade"
                                : "Trade for"}
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
              No moves yet. Trades, signings, and players removed from the 40-man show up here and can be undone.
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
    </div>
  );
}
