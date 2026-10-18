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
        borderRadius: "18px",
        // Same red as the home page scoreboard and the rolling trend chart;
        // the stat boxes inside stay white.
        background: "linear-gradient(155deg, #c8253f 0%, #7d0f1f 100%)",
        color: "#fdfaf3",
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
            border: "1px solid rgba(253,250,243,0.3)",
            background: "rgba(253,250,243,0.14)",
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
                  background: active ? "#fdfaf3" : "transparent",
                  color: active ? "#a8172f" : "rgba(253,250,243,0.85)",
                  boxShadow: active ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
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
