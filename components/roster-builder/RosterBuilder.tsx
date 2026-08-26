"use client";

import { useMemo, useState } from "react";
import { playerHeadshotUrl, type RosterEntry, type ExternalPlayer } from "@/lib/mlb";
import PlayerHeadshot from "@/components/shared/PlayerHeadshot";
import type { ProspectPlayer } from "@/lib/prospects";

type SlotGroup = "diamond" | "dh" | "bench" | "rotation" | "bullpen";

type SlotDef = {
  id: string;
  label: string;
  group: SlotGroup;
  top?: string;
  left?: string;
};

const DIAMOND_SLOTS: SlotDef[] = [
  { id: "C", label: "C", group: "diamond", top: "90%", left: "50%" },
  { id: "1B", label: "1B", group: "diamond", top: "62%", left: "83%" },
  { id: "2B", label: "2B", group: "diamond", top: "42%", left: "66%" },
  { id: "SS", label: "SS", group: "diamond", top: "42%", left: "34%" },
  { id: "3B", label: "3B", group: "diamond", top: "62%", left: "17%" },
  { id: "LF", label: "LF", group: "diamond", top: "16%", left: "18%" },
  { id: "CF", label: "CF", group: "diamond", top: "12%", left: "50%" },
  { id: "RF", label: "RF", group: "diamond", top: "16%", left: "82%" },
];

const DH_SLOT: SlotDef = { id: "DH", label: "DH", group: "dh" };
const BENCH_SLOTS: SlotDef[] = [1, 2, 3, 4].map((n) => ({ id: `BN${n}`, label: `Bench ${n}`, group: "bench" }));
const ROTATION_SLOTS: SlotDef[] = [1, 2, 3, 4, 5].map((n) => ({ id: `SP${n}`, label: `SP${n}`, group: "rotation" }));
const BULLPEN_SLOTS: SlotDef[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `RP${n}`, label: `RP${n}`, group: "bullpen" }));

const ALL_SLOTS: SlotDef[] = [DH_SLOT, ...DIAMOND_SLOTS, ...BENCH_SLOTS, ...ROTATION_SLOTS, ...BULLPEN_SLOTS];
const TOTAL_SLOTS = ALL_SLOTS.length;
const FORTY_MAN_LIMIT = 40;
const PLAYER_ID_DRAG_TYPE = "text/plain";

type SimplePlayer = { id: number; fullName: string; position: string; level?: string };
type AddTab = "prospects" | "external";

function lastName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
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
          {player ? lastName(player.fullName) : "+"}
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

  const fortyManIds = useMemo(() => new Set(fortyMan.map((player) => player.id)), [fortyMan]);
  const fortyManById = useMemo(() => new Map(fortyMan.map((player) => [player.id, player])), [fortyMan]);

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter((id): id is number => id !== null && id !== undefined)),
    [assignments]
  );
  const filledCount = assignedIds.size;

  const addPool = useMemo(() => {
    const trimmed = addQuery.trim().toLowerCase();
    const base: SimplePlayer[] = addTab === "prospects" ? prospects : externalPlayers;

    return base
      .filter((player) => !fortyManIds.has(player.id))
      .filter((player) => !trimmed || player.fullName.toLowerCase().includes(trimmed))
      .slice(0, addTab === "external" && !trimmed ? 0 : 8);
  }, [addTab, addQuery, prospects, externalPlayers, fortyManIds]);

  const openSlotDef = ALL_SLOTS.find((slot) => slot.id === openSlotId) ?? null;

  const slotEligiblePlayers = useMemo(() => {
    if (!openSlotDef) {
      return [];
    }

    const wantsPitcher = isPitcherSlot(openSlotDef.group);
    const trimmed = slotQuery.trim().toLowerCase();

    return fortyMan
      .filter((player) => (player.position === "P") === wantsPitcher)
      .filter((player) => !assignedIds.has(player.id))
      .filter((player) => !trimmed || player.fullName.toLowerCase().includes(trimmed))
      .slice(0, 8);
  }, [openSlotDef, fortyMan, assignedIds, slotQuery]);

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

    setFortyMan((current) => [...current, { id: player.id, fullName: player.fullName, position: player.position }]);
    setRemovedPlayers((current) => current.filter((p) => p.id !== player.id));
    return true;
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
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
            <div
              style={{
                position: "relative",
                flex: "1 1 auto",
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
                  player={fortyManById.get(assignments[slot.id] ?? -1) ?? null}
                  isOpen={openSlotId === slot.id}
                  onToggleOpen={toggleSlotOpen}
                  onDrop={handleDropOnSlot}
                  onDragStart={handleDragStart}
                  onClear={(s) => unassignPlayer(assignments[s.id] ?? -1)}
                  query={slotQuery}
                  onQueryChange={setSlotQuery}
                  eligiblePlayers={slotEligiblePlayers}
                  onSelect={selectForSlot}
                />
              ))}
            </div>

            <div style={{ width: "72px", flexShrink: 0 }}>
              <SlotCell
                slot={DH_SLOT}
                player={fortyManById.get(assignments[DH_SLOT.id] ?? -1) ?? null}
                isOpen={openSlotId === DH_SLOT.id}
                onToggleOpen={toggleSlotOpen}
                onDrop={handleDropOnSlot}
                onDragStart={handleDragStart}
                onClear={(s) => unassignPlayer(assignments[s.id] ?? -1)}
                query={slotQuery}
                onQueryChange={setSlotQuery}
                eligiblePlayers={slotEligiblePlayers}
                onSelect={selectForSlot}
              />
            </div>
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
                player={fortyManById.get(assignments[slot.id] ?? -1) ?? null}
                isOpen={openSlotId === slot.id}
                onToggleOpen={toggleSlotOpen}
                onDrop={handleDropOnSlot}
                onDragStart={handleDragStart}
                onClear={(s) => unassignPlayer(assignments[s.id] ?? -1)}
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
                player={fortyManById.get(assignments[slot.id] ?? -1) ?? null}
                isOpen={openSlotId === slot.id}
                onToggleOpen={toggleSlotOpen}
                onDrop={handleDropOnSlot}
                onDragStart={handleDragStart}
                onClear={(s) => unassignPlayer(assignments[s.id] ?? -1)}
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
                player={fortyManById.get(assignments[slot.id] ?? -1) ?? null}
                isOpen={openSlotId === slot.id}
                onToggleOpen={toggleSlotOpen}
                onDrop={handleDropOnSlot}
                onDragStart={handleDragStart}
                onClear={(s) => unassignPlayer(assignments[s.id] ?? -1)}
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
                <span style={{ color: "var(--muted)", fontWeight: 400 }}>{player.position}</span>
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
              style={addTabButtonStyle(addTab === "external")}
              onClick={() => { setAddTab("external"); setAddQuery(""); }}
            >
              External Players
            </button>
          </div>

          <input
            type="text"
            value={addQuery}
            onChange={(event) => setAddQuery(event.target.value)}
            placeholder={
              addTab === "external" ? "Search any MLB player by name..." : "Search Cardinals prospects..."
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

          <div style={{ display: "grid", gap: "0.5rem" }}>
            {addTab === "external" && !addQuery.trim() ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>Type a name to search all of MLB.</p>
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
        </div>
      </div>
    </div>
  );
}
