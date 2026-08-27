"use client";

import { useMemo, useState } from "react";
import { teamLogoUrl, type GameLogEntry, type PlayerRole } from "@/lib/mlb";
import TeamLogo from "@/components/shared/TeamLogo";

function formatLogDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

const HITTER_LOG_COLUMNS = ["AB", "R", "H", "HR", "RBI", "BB", "SO"] as const;
const PITCHER_LOG_COLUMNS = ["IP", "H", "R", "ER", "BB", "K"] as const;

function hitterLogRow(stat: GameLogEntry["stat"]): Record<string, string> {
  return {
    AB: String(stat.atBats ?? 0),
    R: String(stat.runs ?? 0),
    H: String(stat.hits ?? 0),
    HR: String(stat.homeRuns ?? 0),
    RBI: String(stat.rbi ?? 0),
    BB: String(stat.baseOnBalls ?? 0),
    SO: String(stat.strikeOuts ?? 0),
  };
}

function pitcherLogRow(stat: GameLogEntry["stat"]): Record<string, string> {
  return {
    IP: stat.inningsPitched ?? "-",
    H: String(stat.hits ?? 0),
    R: String(stat.runs ?? 0),
    ER: String(stat.earnedRuns ?? 0),
    BB: String(stat.baseOnBalls ?? 0),
    K: String(stat.strikeOuts ?? 0),
  };
}

export default function GameLogTable({ gameLog, role }: { gameLog: GameLogEntry[]; role: PlayerRole }) {
  const [mode, setMode] = useState<"last15" | "all">("last15");

  const columns = role === "Pitcher" ? PITCHER_LOG_COLUMNS : HITTER_LOG_COLUMNS;
  const buildRow = role === "Pitcher" ? pitcherLogRow : hitterLogRow;

  const rows = useMemo(() => {
    const newestFirst = [...gameLog].reverse();

    return mode === "last15" ? newestFirst.slice(0, 15) : newestFirst;
  }, [gameLog, mode]);

  return (
    <div className="game-log-root" style={{ display: "grid", gap: "0.6rem" }}>
      <div className="game-log-tabs" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
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
                padding: "0.45rem 0.8rem",
                fontSize: "0.8rem",
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "480px", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "0.72rem" }}>
                <th style={{ padding: "0.4rem 0.6rem" }}>Date</th>
                <th style={{ padding: "0.4rem 0.6rem" }}>Opponent</th>
                <th style={{ padding: "0.4rem 0.6rem" }}>Result</th>
                {columns.map((column) => (
                  <th key={column} style={{ padding: "0.4rem 0.6rem", textAlign: "center" }}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((game, index) => {
                const row = buildRow(game.stat);

                return (
                  <tr
                    key={`${game.gamePk}-${index}`}
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <td style={{ padding: "0.45rem 0.6rem", whiteSpace: "nowrap" }}>
                      {formatLogDate(game.date)}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span>{game.isHome ? "vs" : "@"}</span>
                        <TeamLogo
                          src={teamLogoUrl(game.opponentId)}
                          alt={game.opponentName}
                          style={{ width: 20, height: 20 }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
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
                    {columns.map((column) => (
                      <td key={column} style={{ padding: "0.45rem 0.6rem", textAlign: "center" }}>
                        {row[column]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
