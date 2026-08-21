"use client";

import { useMemo, useState } from "react";
import type { GameLogEntry } from "@/lib/mlb";

function formatLogDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export default function GameLogTable({ gameLog }: { gameLog: GameLogEntry[] }) {
  const [mode, setMode] = useState<"last15" | "all">("last15");

  const rows = useMemo(() => {
    const newestFirst = [...gameLog].reverse();

    return mode === "last15" ? newestFirst.slice(0, 15) : newestFirst;
  }, [gameLog, mode]);

  return (
    <div className="game-log-root" style={{ display: "grid", gap: "0.75rem" }}>
      <div className="game-log-tabs" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {(
          [
            { key: "last15" as const, label: "Last 15" },
            { key: "all" as const, label: "All Games" },
          ]
        ).map((tab) => {
          const isActive = mode === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMode(tab.key)}
              style={{
                border: `1px solid ${isActive ? "#8a1024" : "var(--line)"}`,
                background: isActive
                  ? "rgba(194,30,58,0.12)"
                  : "rgba(15,31,61,0.02)",
                color: "var(--text)",
                borderRadius: "999px",
                padding: "0.55rem 1rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No games found for this season.</p>
      ) : (
        <div className="game-log-scroll" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "480px" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "0.85rem" }}>
                <th style={{ padding: "0.5rem 0.75rem" }}>Date</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Opponent</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Result</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Line</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((game, index) => (
                <tr
                  key={`${game.gamePk}-${index}`}
                  style={{ borderTop: "1px solid var(--line)" }}
                >
                  <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
                    {formatLogDate(game.date)}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {game.isHome ? "vs" : "@"} {game.opponentName}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {game.isWin === undefined ? (
                      "-"
                    ) : (
                      <span
                        style={{
                          fontWeight: 800,
                          color: game.isWin ? "#0f7a38" : "#b42318",
                        }}
                      >
                        {game.isWin ? "W" : "L"}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "var(--muted)" }}>
                    {game.summary ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
