"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  LeaderboardCategory,
  StatsLeadersPageData,
} from "./playerReportTypes";

type Props = {
  data: StatsLeadersPageData;
};

function LeaderCard({ category }: { category: LeaderboardCategory }) {
  return (
    <article
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "1rem",
        display: "grid",
        gap: "0.9rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "baseline",
        }}
      >
        <div>
          <p className="kicker" style={{ marginBottom: "0.35rem" }}>
            {category.description}
          </p>
          <h3 style={{ margin: 0 }}>{category.label}</h3>
        </div>
      </div>

      {category.players.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>
          No players available for this leaderboard.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {category.players.map((player, index) => (
            <Link
              key={`${category.key}-${player.id}`}
              href={`/players/${player.id}`}
              style={{
                display: "grid",
                gap: "1.1rem",
                gridTemplateColumns: "84px minmax(0, 1fr) auto",
                alignItems: "center",
                border: "1px solid var(--line)",
                borderRadius: "16px",
                padding: "0.8rem",
                background: "rgba(15,31,61,0.02)",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              {/* Player Headshot */}
              <div
                style={{
                  width: "84px",
                  height: "104px",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <img
                  src={player.imageUrl}
                  alt={`Headshot of ${player.name}`}
                  loading="lazy"
                  style={{
                    width: "84px",
                    height: "104px",
                    borderRadius: "16px",
                    objectFit: "cover",
                    objectPosition: "center top",
                    border: "1px solid var(--line)",
                    background: "#f3f4f6",
                    display: "block",
                  }}
                />

                <span
                  style={{
                    position: "absolute",
                    top: "-8px",
                    left: "-8px",
                    width: "24px",
                    height: "24px",
                    borderRadius: "999px",
                    background: "#111827",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    border: "2px solid var(--panel)",
                  }}
                >
                  {index + 1}
                </span>
              </div>

              {/* Player Name and Position */}
              <div
                style={{
                  minWidth: 0,
                  paddingLeft: "0.15rem",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontWeight: 800,
                    lineHeight: 1.25,
                  }}
                >
                  {player.name}
                </p>

                <p
                  style={{
                    margin: "0.35rem 0 0",
                    color: "var(--muted)",
                    fontSize: "0.9rem",
                  }}
                >
                  {player.position}
                </p>
              </div>

              {/* Stat */}
              <div
                style={{
                  fontWeight: 900,
                  fontSize: "1.25rem",
                  whiteSpace: "nowrap",
                }}
              >
                {player.displayValue}
              </div>
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

export default function PlayerReportBrowser({ data }: Props) {
  const [activeTab, setActiveTab] = useState<"hitters" | "pitchers">(
    "hitters"
  );

  const active = activeTab === "hitters" ? data.hitters : data.pitchers;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div
        style={{
          display: "grid",
          gap: "0.9rem",
          gridTemplateColumns: "minmax(0, 1fr)",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.65rem",
          }}
        >
          {[
            { key: "hitters" as const, label: "Hitters" },
            { key: "pitchers" as const, label: "Pitchers" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  border: `1px solid ${
                    isActive ? "#8a1024" : "var(--line)"
                  }`,
                  background: isActive
                    ? "rgba(194,30,58,0.12)"
                    : "rgba(15,31,61,0.02)",
                  color: "var(--text)",
                  borderRadius: "999px",
                  padding: "0.75rem 1rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        {active.categories.map((category) => (
          <LeaderCard key={category.key} category={category} />
        ))}
      </div>
    </div>
  );
}