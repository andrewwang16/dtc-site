"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { playerHeadshotUrl, type RosterEntry } from "@/lib/mlb";
import PlayerHeadshot from "@/components/shared/PlayerHeadshot";

export default function PlayerSearch({ roster }: { roster: RosterEntry[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return [];
    }

    return roster
      .filter((player) => player.fullName.toLowerCase().includes(trimmed))
      .slice(0, 8);
  }, [roster, query]);

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "1.15rem",
      }}
    >
      <p className="kicker" style={{ marginBottom: "0.5rem" }}>
        Find a Player
      </p>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Cardinals players..."
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
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "12px",
                  border: "1px solid var(--line)",
                  background: "rgba(15,31,61,0.02)",
                  color: "inherit",
                  textDecoration: "none",
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
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center",
                    }}
                  />
                </div>

                <span style={{ fontWeight: 700 }}>{player.fullName}</span>
                <span style={{ color: "var(--muted)", marginLeft: "auto" }}>
                  {player.position}
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
