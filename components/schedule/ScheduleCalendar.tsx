"use client";

import { useState } from "react";
import {
  formatGameTime,
  getCardinalsResult,
  getGameCardTheme,
  getHomeAwayLabel,
  getOpponent,
  getTeamLogoUrl,
  isPostponed,
  type MlbGame,
} from "./scheduleUtils";
import GameDetailModal from "./GameDetailModal";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarCell = {
  day: number;
  dateKey: string;
};

export default function ScheduleCalendar({
  year,
  month,
  gamesByDate,
}: {
  year: number;
  month: number;
  gamesByDate: Array<{ date: string; games: MlbGame[] }>;
}) {
  const [selectedGame, setSelectedGame] = useState<MlbGame | null>(null);

  const gamesByDay = new Map<string, MlbGame[]>();
  for (const group of gamesByDate) {
    gamesByDay.set(group.date, group.games);
  }

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstOfMonth.getDay();

  const cells: Array<CalendarCell | null> = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: Array<Array<CalendarCell | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "0.4rem",
          marginBottom: "0.5rem",
        }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            style={{
              textAlign: "center",
              color: "var(--muted)",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: "0.4rem" }}>
        {weeks.map((week, weekIndex) => (
          <div
            key={weekIndex}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "0.4rem",
            }}
          >
            {week.map((cell, cellIndex) => {
              if (!cell) {
                return <div key={cellIndex} />;
              }

              const dayGames = gamesByDay.get(cell.dateKey) ?? [];

              return (
                <div
                  key={cell.dateKey}
                  style={{
                    minHeight: "98px",
                    border: "1px solid var(--line)",
                    borderRadius: "12px",
                    padding: "0.4rem",
                    background: "rgba(15,31,61,0.02)",
                    display: "grid",
                    gap: "0.3rem",
                    alignContent: "start",
                  }}
                >
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{cell.day}</span>

                  {dayGames.map((game) => {
                    const theme = getGameCardTheme(game);
                    const opponent = getOpponent(game);
                    const result = getCardinalsResult(game);
                    const postponed = isPostponed(game);
                    const isFinal = game.status.abstractGameState === "Final" && !postponed;
                    const resultColor = result.isTie
                      ? theme.muted
                      : result.isWin
                        ? "#0f7a38"
                        : "#b42318";

                    return (
                      <button
                        key={game.gamePk}
                        type="button"
                        onClick={() => setSelectedGame(game)}
                        style={{
                          textAlign: "left",
                          border: `1px solid ${theme.border}`,
                          borderRadius: "8px",
                          background: theme.background,
                          color: theme.text,
                          padding: "0.35rem 0.4rem",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          lineHeight: 1.3,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 800 }}>
                          <span>{getHomeAwayLabel(game) === "Home" ? "vs" : "@"}</span>
                          <img
                            src={getTeamLogoUrl(opponent.team.id)}
                            alt={opponent.team.name}
                            title={opponent.team.name}
                            width={24}
                            height={24}
                            style={{ display: "block" }}
                          />
                        </div>
                        <div
                          style={{
                            color: postponed ? theme.muted : isFinal ? resultColor : theme.muted,
                            fontWeight: isFinal ? 800 : 400,
                            fontSize: "0.85rem",
                          }}
                        >
                          {postponed
                            ? "PPD"
                            : isFinal
                              ? `${result.isWin ? "W" : result.isTie ? "T" : "L"} ${result.cardinalsScore}-${result.opponentScore}`
                              : formatGameTime(game.gameDate)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {selectedGame && (
        <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      )}
    </div>
  );
}
