"use client";

import { useMemo, useState } from "react";
import { playerHeadshotUrl, type RosterEntry, type ExternalPlayer } from "@/lib/mlb";
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
  { id: "2B", label: "2B", group: "diamond", top: "24%", left: "50%" },
  { id: "SS", label: "SS", group: "diamond", top: "42%", left: "34%" },
  { id: "3B", label: "3B", group: "diamond", top: "62%", left: "17%" },
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
const FORTY_MAN_LIMIT = 40;

type SimplePlayer = { id: number; fullName: string; position: string };
type PickerTab = "fortyMan" | "prospects" | "external";

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
  player: SimplePlayer | null;
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
          width: "58px",
          height: "58px",
          borderRadius: "50%",
          zIndex: 1,
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

function DiamondOutline() {
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <polygon points="50,90 83,62 50,24 17,62" fill="none" stroke="var(--line)" strokeWidth="1.5" />
    </svg>
  );
}

export default function RosterBuilder({
  roster,
  prospects,
  externalPlayers,
}: {
  roster: RosterEntry[];
  prospects: ProspectPlayer[];
  externalPlayers: ExternalPlayer[];
}) {
  const [fortyMan, setFortyMan] = useState<SimplePlayer[]>(roster);
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PickerTab>("fortyMan");
  const [query, setQuery] = useState("");

  const fortyManIds = useMemo(() => new Set(fortyMan.map((player) => player.id)), [fortyMan]);

  const playersById = useMemo(() => {
    const map = new Map<number, SimplePlayer>();
    for (const player of fortyMan) map.set(player.id, player);
    for (const player of prospects) if (!map.has(player.id)) map.set(player.id, player);
    for (const player of externalPlayers) if (!map.has(player.id)) map.set(player.id, player);
    return map;
  }, [fortyMan, prospects, externalPlayers]);

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter((id): id is number => id !== null && id !== undefined)),
    [assignments]
  );
  const filledCount = assignedIds.size;

  const activeSlotDef = ALL_SLOTS.find((slot) => slot.id === activeSlot) ?? null;
  const activeSlotPlayer = activeSlotDef ? playersById.get(assignments[activeSlotDef.id] ?? -1) ?? null : null;

  const eligiblePool = useMemo((): Array<SimplePlayer & { level?: string }> => {
    if (!activeSlotDef) {
      return [];
    }

    const wantsPitcher = isPitcherSlot(activeSlotDef.group);
    const trimmed = query.trim().toLowerCase();

    const base: Array<SimplePlayer & { level?: string }> =
      activeTab === "fortyMan" ? fortyMan : activeTab === "prospects" ? prospects : externalPlayers;

    return base
      .filter((player) => activeTab === "fortyMan" || !fortyManIds.has(player.id))
      .filter((player) => (player.position === "P") === wantsPitcher)
      .filter((player) => !assignedIds.has(player.id) || player.id === assignments[activeSlotDef.id])
      .filter((player) => !trimmed || player.fullName.toLowerCase().includes(trimmed))
      .slice(0, activeTab === "external" && !trimmed ? 0 : 8);
  }, [activeSlotDef, activeTab, assignedIds, assignments, fortyMan, fortyManIds, prospects, externalPlayers, query]);

  function openSlot(slotId: string) {
    setQuery("");
    setActiveTab("fortyMan");
    setActiveSlot((current) => (current === slotId ? null : slotId));
  }

  function assign(player: SimplePlayer) {
    if (!activeSlotDef) {
      return;
    }

    if (!fortyManIds.has(player.id)) {
      const projected = fortyMan.length + 1;

      if (projected > FORTY_MAN_LIMIT) {
        const confirmed = window.confirm(
          `Adding ${player.fullName} would put the 40-man roster at ${projected}, over the ${FORTY_MAN_LIMIT}-man limit. Add anyway?`
        );

        if (!confirmed) {
          return;
        }
      }

      setFortyMan((current) => [...current, { id: player.id, fullName: player.fullName, position: player.position }]);
    }

    setAssignments((current) => ({ ...current, [activeSlotDef.id]: player.id }));
    setActiveSlot(null);
    setQuery("");
  }

  function clearActiveSlot() {
    if (!activeSlotDef) {
      return;
    }

    setAssignments((current) => ({ ...current, [activeSlotDef.id]: null }));
  }

  function removeFromFortyMan(playerId: number) {
    setFortyMan((current) => current.filter((player) => player.id !== playerId));
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

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
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
                aspectRatio: "1 / 1",
                borderRadius: "18px",
                border: "1px solid var(--line)",
                background: "var(--panel)",
              }}
            >
              <DiamondOutline />
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

            <div style={{ width: "72px", flexShrink: 0 }}>
              <SlotButton
                slot={DH_SLOT}
                player={playersById.get(assignments[DH_SLOT.id] ?? -1) ?? null}
                isActive={activeSlot === DH_SLOT.id}
                onClick={() => openSlot(DH_SLOT.id)}
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

          <p className="kicker" style={{ margin: "1.25rem 0 0.6rem" }}>
            Bench
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "0.5rem" }}>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
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

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" style={tabButtonStyle(activeTab === "fortyMan")} onClick={() => { setActiveTab("fortyMan"); setQuery(""); }}>
              40-Man Roster
            </button>
            <button type="button" style={tabButtonStyle(activeTab === "prospects")} onClick={() => { setActiveTab("prospects"); setQuery(""); }}>
              Prospects
            </button>
            <button type="button" style={tabButtonStyle(activeTab === "external")} onClick={() => { setActiveTab("external"); setQuery(""); }}>
              External Players
            </button>
          </div>

          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              activeTab === "external"
                ? "Search any MLB player by name..."
                : isPitcherSlot(activeSlotDef.group)
                  ? "Search pitchers..."
                  : "Search position players..."
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
            {activeTab === "external" && !query.trim() ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>Type a name to search all of MLB.</p>
            ) : eligiblePool.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>No eligible players found.</p>
            ) : (
              eligiblePool.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => assign(player)}
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
                  {player.level && (
                    <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{player.level}</span>
                  )}
                  <span style={{ color: "var(--muted)", marginLeft: "auto", fontSize: "0.85rem" }}>
                    {player.position}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div>
        <p className="kicker" style={{ marginBottom: "0.6rem" }}>
          40-Man Roster ({fortyMan.length} / {FORTY_MAN_LIMIT})
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
          {fortyMan.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>No players on the 40-man roster.</p>
          ) : (
            fortyMan.map((player) => (
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
    </div>
  );
}
