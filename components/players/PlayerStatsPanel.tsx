"use client";

import { useState, type ReactNode } from "react";

export type StatsView = "standard" | "statcast";

export const STATS_VIEW_PARAM = "stats";

const VIEWS: Array<{ key: StatsView; label: string }> = [
  { key: "standard", label: "Standard" },
  { key: "statcast", label: "Statcast" },
];

// Keeps the chosen view when the season or team dropdown reloads the page.
export function statsViewQuery() {
  if (typeof window === "undefined") {
    return "";
  }
  const view = new URLSearchParams(window.location.search).get(STATS_VIEW_PARAM);
  return view === "statcast" ? `&${STATS_VIEW_PARAM}=statcast` : "";
}

// Season stats and Statcast percentiles in one card, switched with a toggle.
// Both views are rendered on the server; switching is instant and only
// rewrites the URL so a refresh or shared link lands on the same view.
export default function PlayerStatsPanel({
  initialView,
  controls,
  standard,
  statcast,
}: {
  initialView: StatsView;
  controls: ReactNode;
  standard: ReactNode;
  statcast: ReactNode;
}) {
  const [view, setView] = useState<StatsView>(initialView);

  function selectView(next: StatsView) {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "statcast") {
      url.searchParams.set(STATS_VIEW_PARAM, "statcast");
    } else {
      url.searchParams.delete(STATS_VIEW_PARAM);
    }
    window.history.replaceState(null, "", url);
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "1.15rem",
        minWidth: 0,
      }}
    >
      <div
        className="player-stats-panel-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem 1rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        <div
          role="tablist"
          aria-label="Stat type"
          className="player-stats-toggle"
          style={{
            display: "inline-flex",
            padding: "0.25rem",
            borderRadius: "999px",
            border: "1px solid var(--line)",
            background: "var(--bg-soft)",
          }}
        >
          {VIEWS.map((option) => {
            const active = option.key === view;
            return (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectView(option.key)}
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "0.5rem 1.15rem",
                  fontWeight: 800,
                  fontSize: "0.92rem",
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--muted)",
                  boxShadow: active ? "0 2px 8px rgba(196,30,58,0.25)" : "none",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div
          className="player-header-controls"
          style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}
        >
          {controls}
        </div>
      </div>

      <div role="tabpanel">{view === "standard" ? standard : statcast}</div>
    </div>
  );
}
