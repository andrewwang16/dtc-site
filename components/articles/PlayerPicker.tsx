"use client";

import { useMemo, useState } from "react";
import { playerHeadshotUrl, stripDiacritics, type RosterEntry } from "@/lib/mlb";
import PlayerHeadshot from "@/components/shared/PlayerHeadshot";

export default function PlayerPicker({
  roster,
  selected,
  onSelect,
  onClear,
  placeholder = "Search Cardinals players to attach...",
}: {
  roster: RosterEntry[];
  selected: RosterEntry | null;
  onSelect: (player: RosterEntry) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const trimmed = stripDiacritics(query.trim().toLowerCase());

    if (!trimmed) {
      return [];
    }

    return roster
      .filter((player) => stripDiacritics(player.fullName.toLowerCase()).includes(trimmed))
      .slice(0, 8);
  }, [roster, query]);

  if (selected) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "0.9rem 1.15rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              overflow: "hidden",
              flexShrink: 0,
              background: "rgba(15,31,61,.08)",
              border: "1px solid var(--line)",
            }}
          >
            <PlayerHeadshot
              src={playerHeadshotUrl(selected.id, 80)}
              alt={selected.fullName}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
            />
          </div>
          <span style={{ fontWeight: 700 }}>{selected.fullName}</span>
        </div>

        <button
          type="button"
          onClick={onClear}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.4rem 0.8rem",
            borderRadius: "999px",
            border: "1px solid var(--line)",
            background: "rgba(15,31,61,0.02)",
            color: "#b42318",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "1.15rem",
      }}
    >
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "0.75rem 1rem",
          borderRadius: "999px",
          border: "1px solid var(--line)",
          background: "var(--bg-soft)",
          color: "var(--text)",
          fontSize: "1rem",
        }}
      />

      {query.trim() ? (
        <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.5rem" }}>
          {results.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No players found for &quot;{query}&quot;.
            </p>
          ) : (
            results.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => {
                  onSelect(player);
                  setQuery("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "12px",
                  border: "1px solid var(--line)",
                  background: "rgba(15,31,61,0.02)",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    background: "rgba(15,31,61,.08)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <PlayerHeadshot
                    src={playerHeadshotUrl(player.id, 80)}
                    alt={player.fullName}
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
                  />
                </div>

                <span style={{ fontWeight: 700 }}>{player.fullName}</span>
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>{player.position}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
