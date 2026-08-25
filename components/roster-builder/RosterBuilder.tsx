"use client";

import { useMemo, useState } from "react";
import { playerHeadshotUrl, type RosterEntry } from "@/lib/mlb";

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
  { id: "1B", label: "1B", group: "diamond", top: "64%", left: "80%" },
  { id: "2B", label: "2B", group: "diamond", top: "38%", left: "65%" },
  { id: "SS", label: "SS", group: "diamond", top: "38%", left: "35%" },
  { id: "3B", label: "3B", group: "diamond", top: "64%", left: "20%" },
  { id: "LF", label: "LF", group: "diamond", top: "14%", left: "18%" },
  { id: "CF", label: "CF", group: "diamond", top: "4%", left: "50%" },
  { id: "RF", label: "RF", group: "diamond", top: "14%", left: "82%" },
];

const DH_SLOT: SlotDef = { id: "DH", label: "DH", group: "dh" };
const BENCH_SLOTS: SlotDef[] = [1, 2, 3, 4].map((n) => ({ id: `BN${n}`, label: `Bench ${n}`, group: "bench" }));
const ROTATION_SLOTS: SlotDef[] = [1, 2, 3, 4, 5].map((n) => ({ id: `SP${n}`, label: `SP${n}`, group: "rotation" }));
const BULLPEN_SLOTS: SlotDef[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `RP${n}`, label: `RP${n}`, group: "bullpen" }));

const ALL_SLOTS: SlotDef[] = [DH_SLOT, ...DIAMOND_SLOTS, ...BENCH_SLOTS, ...ROTATION_SLOTS, ...BULLPEN_SLOTS];
const TOTAL_SLOTS = ALL_SLOTS.length;

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

function SlotButton({
  slot,
  player,
  isActive,
  onClick,
}: {
  slot: SlotDef;
  player: RosterEntry | null;
  isActive: boolean;
  onClick: () => void;
}) {
  const isDiamond = slot.group === "diamond";

  const style: React.CSSProperties = {
    ...slotButtonBase,
    ...(isDiamond
      ? {
          position: "absolute",
          top: slot.top,
          left: slot.left,
          transform: "translate(-50%, -50%)",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
        }
      : {
          width: "100%",
          minHeight: "56px",
          borderRadius: "12px",
        }),
    border: isActive ? "2px solid var(--accent)" : "1px solid var(--line)",
    background: player ? "rgba(196,30,58,0.08)" : "var(--panel)",
  };

  return (
    <button type="button" onClick={onClick} style={style}>
      <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
        {slot.label}
      </span>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, lineHeight: 1.1 }}>
        {player ? lastName(player.fullName) : "+"}
      </span>
    </button>
  );
}

export default function RosterBuilder({ roster }: { roster: RosterEntry[] }) {
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const playersById = useMemo(() => new Map(roster.map((player) => [player.id, player])), [roster]);
  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter((id): id is number => id !== null && id !== undefined)),
    [assignments]
  );
  const filledCount = assignedIds.size;

  const activeSlotDef = ALL_SLOTS.find((slot) => slot.id === activeSlot) ?? null;
  const activeSlotPlayer = activeSlotDef ? playersById.get(assignments[activeSlotDef.id] ?? -1) ?? null : null;

  const eligiblePlayers = useMemo(() => {
    if (!activeSlotDef) {
      return [];
    }

    const wantsPitcher = isPitcherSlot(activeSlotDef.group);
    const trimmed = query.trim().toLowerCase();

    return roster
      .filter((player) => (player.position === "P") === wantsPitcher)
      .filter((player) => !assignedIds.has(player.id) || player.id === assignments[activeSlotDef.id])
      .filter((player) => !trimmed || player.fullName.toLowerCase().includes(trimmed))
      .slice(0, 8);
  }, [activeSlotDef, assignedIds, assignments, query, roster]);

  function openSlot(slotId: string) {
    setQuery("");
    setActiveSlot((current) => (current === slotId ? null : slotId));
  }

  function assign(playerId: number) {
    if (!activeSlotDef) {
      return;
    }

    setAssignments((current) => ({ ...current, [activeSlotDef.id]: playerId }));
    setActiveSlot(null);
    setQuery("");
  }

  function clearActiveSlot() {
    if (!activeSlotDef) {
      return;
    }

    setAssignments((current) => ({ ...current, [activeSlotDef.id]: null }));
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <p style={{ margin: 0, color: "var(--muted)", fontWeight: 700 }}>
        {filledCount} / {TOTAL_SLOTS} roster spots filled
      </p>

      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "minmax(280px, 380px) 1fr" }}>
        <div>
          <p className="kicker" style={{ marginBottom: "0.6rem" }}>
            Field
          </p>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: "18px",
              border: "1px solid var(--line)",
              background:
                "radial-gradient(circle at 50% 100%, rgba(15,122,56,0.12), transparent 65%), var(--panel)",
            }}
          >
            {DIAMOND_SLOTS.map((slot) => (
              <SlotButton
                key={slot.id}
                slot={slot}
                player={playersById.get(assignments[slot.id] ?? -1) ?? null}
                isActive={activeSlot === slot.id}
                onClick={() => openSlot(slot.id)}
              />
            ))}
          </div>

          <div style={{ marginTop: "0.75rem", maxWidth: "140px" }}>
            <SlotButton
              slot={DH_SLOT}
              player={playersById.get(assignments[DH_SLOT.id] ?? -1) ?? null}
              isActive={activeSlot === DH_SLOT.id}
              onClick={() => openSlot(DH_SLOT.id)}
            />
          </div>

          <p className="kicker" style={{ margin: "1.25rem 0 0.6rem" }}>
            Bench
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
            {BENCH_SLOTS.map((slot) => (
              <SlotButton
                key={slot.id}
                slot={slot}
                player={playersById.get(assignments[slot.id] ?? -1) ?? null}
                isActive={activeSlot === slot.id}
                onClick={() => openSlot(slot.id)}
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
              <SlotButton
                key={slot.id}
                slot={slot}
                player={playersById.get(assignments[slot.id] ?? -1) ?? null}
                isActive={activeSlot === slot.id}
                onClick={() => openSlot(slot.id)}
              />
            ))}
          </div>

          <p className="kicker" style={{ margin: "1.25rem 0 0.6rem" }}>
            Bullpen
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "0.5rem" }}>
            {BULLPEN_SLOTS.map((slot) => (
              <SlotButton
                key={slot.id}
                slot={slot}
                player={playersById.get(assignments[slot.id] ?? -1) ?? null}
                isActive={activeSlot === slot.id}
                onClick={() => openSlot(slot.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {activeSlotDef && (
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <p style={{ margin: 0, fontWeight: 800 }}>Assigning: {activeSlotDef.label}</p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {activeSlotPlayer && (
                <button
                  type="button"
                  onClick={clearActiveSlot}
                  style={{
                    border: "1px solid var(--line)",
                    background: "none",
                    color: "#b42318",
                    fontWeight: 700,
                    borderRadius: "999px",
                    padding: "0.35rem 0.8rem",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveSlot(null)}
                style={{
                  border: "1px solid var(--line)",
                  background: "none",
                  color: "var(--text)",
                  fontWeight: 700,
                  borderRadius: "999px",
                  padding: "0.35rem 0.8rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Close
              </button>
            </div>
          </div>

          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isPitcherSlot(activeSlotDef.group) ? "Search pitchers..." : "Search position players..."}
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
            {eligiblePlayers.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>No eligible players found.</p>
            ) : (
              eligiblePlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => assign(player.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.65rem",
                    padding: "0.5rem 0.7rem",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    background:
                      player.id === assignments[activeSlotDef.id] ? "rgba(196,30,58,0.1)" : "rgba(15,31,61,0.02)",
                    color: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
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
                    <img
                      src={playerHeadshotUrl(player.id, 68)}
                      alt={player.fullName}
                      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                    />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{player.fullName}</span>
                  <span style={{ color: "var(--muted)", marginLeft: "auto", fontSize: "0.85rem" }}>
                    {player.position}
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
