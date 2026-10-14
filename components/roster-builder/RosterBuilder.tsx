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
  type ContractInfo,
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

type SimplePlayer = {
  id: number;
  fullName: string;
  lastName?: string;
  position: string;
  debutDate?: string;
  level?: string;
};
type AddTab = "prospects" | "free-agents" | "trades" | "create";
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

// Salary is entered in millions per year. Returns null until both fields
// hold a usable deal.
function parseSigning(salaryText: string, yearsText: string): Signing | null {
  const millions = Number(salaryText);
  const years = Number(yearsText);

  if (!salaryText.trim() || !Number.isFinite(millions) || millions <= 0) {
    return null;
  }

  if (!Number.isInteger(years) || years < 1 || years > MAX_CONTRACT_YEARS) {
    return null;
  }

  return { salary: Math.round(millions * 1_000_000), years };
}

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
// contract on a created or traded-for player.
function SignForm({
  submitLabel,
  initial,
  onSign,
}: {
  submitLabel: string;
  initial?: Signing;
  onSign: (signing: Signing) => void;
}) {
  const [salary, setSalary] = useState(initial ? String(initial.salary / 1_000_000) : "");
  const [years, setYears] = useState(initial ? String(initial.years) : "1");
  const signing = parseSigning(salary, years);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (signing) {
          onSign(signing);
        }
      }}
      style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}
    >
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
      <button type="submit" disabled={!signing} style={{ ...smallButtonStyle, opacity: signing ? 1 : 0.5 }}>
        {submitLabel}
      </button>
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
                  <span style={{ color: "var(--muted)", marginLeft: "auto" }}>{eligible.position}</span>
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
  const [removedPlayers, setRemovedPlayers] = useState<SimplePlayer[]>([]);
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
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

  // Everyone on the 40-man or the 60-day IL is paid. A removed player
  // costs nothing (released / non-tendered) except a declined club
  // option, which still owes the buyout.
  const payroll = useMemo(() => {
    const paidPlayers = [...fortyMan, ...reserveIL];
    const rows = paidPlayers
      .map((player) => ({ player, contract: contractFor(player) }))
      .sort((a, b) => (b.contract?.salary ?? -1) - (a.contract?.salary ?? -1));

    const totals = { guaranteed: 0, arbitration: 0, preArb: 0, buyouts: 0, unknownCount: 0 };

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

    for (const player of removedPlayers) {
      totals.buyouts += contractFor(player)?.buyout ?? 0;
    }

    const total = totals.guaranteed + totals.arbitration + totals.preArb + totals.buyouts;

    return { rows, totals, total };
  }, [fortyMan, reserveIL, removedPlayers, contractFor]);

  const fortyManIds = useMemo(() => new Set(fortyMan.map((player) => player.id)), [fortyMan]);
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
      },
    ]);
    setRemovedPlayers((current) => current.filter((p) => p.id !== player.id));
    return true;
  }

  function setSigning(playerId: number, signing: Signing) {
    setSignings((current) => ({ ...current, [playerId]: signing }));
  }

  function signFreeAgent(freeAgent: FreeAgent, signing: Signing) {
    if (addToFortyMan(freeAgent)) {
      setSigning(freeAgent.id, signing);
    }
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

  function removeFromFortyMan(playerId: number) {
    const player = fortyManById.get(playerId);
    setFortyMan((current) => current.filter((p) => p.id !== playerId));
    unassignPlayer(playerId);
    if (player) {
      setRemovedPlayers((current) => [...current, player]);
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

      <p style={{ margin: 0, color: "var(--muted)", fontWeight: 700 }}>
        {filledCount} / {TOTAL_SLOTS} roster spots filled
      </p>

      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "minmax(280px, 420px) 1fr" }}>
        <div>
          <p className="kicker" style={{ marginBottom: "0.6rem" }}>
            Position Players
          </p>
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
            fortyMan.map((player) => {
              const contract = contractFor(player);

              return (
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
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}>{player.position}</span>
                  {contract && (
                    <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.75rem" }}>
                      {formatSalary(contract.salary)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFromFortyMan(player.id)}
                    aria-label={`Remove ${player.fullName} from the 40-man roster`}
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
              );
            })
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
                <span style={{ color: "var(--muted)", fontWeight: 400 }}>{player.position}</span>
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
                ...(payroll.totals.buyouts > 0 ? [{ label: "Option buyouts", value: payroll.totals.buyouts }] : []),
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
              Removing an arbitration player counts as a non-tender, and removing a club-option player counts as
              declining the option (buyout still owed).
              {payroll.totals.unknownCount > 0 &&
                ` ${payroll.totals.unknownCount} player${payroll.totals.unknownCount === 1 ? " has" : "s have"} no contract set and ${payroll.totals.unknownCount === 1 ? "isn't" : "aren't"} counted.`}
            </p>
          </div>
        )}
      </div>

      <div>
        <p className="kicker" style={{ marginBottom: "0.6rem" }}>
          Removed From 40-Man
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
          {removedPlayers.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>No players have been removed from the 40-man.</p>
          ) : (
            removedPlayers.map((player) => (
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
                <span style={{ color: "var(--muted)", fontWeight: 400 }}>{player.position}</span>
                <button
                  type="button"
                  onClick={() => addToFortyMan(player)}
                  aria-label={`Add ${player.fullName} back to the 40-man roster`}
                  title="Add back to 40-man"
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
                  {addTab === "trades" && !addQuery.trim() ? (
                    <p style={{ margin: 0, color: "var(--muted)" }}>
                      Type a name to search players under contract with other teams. Set their salary from the payroll
                      table once they&apos;re added.
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
                        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{player.position}</span>
                        <button
                          type="button"
                          onClick={() => addToFortyMan(player)}
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
                          Add
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
    </div>
  );
}
