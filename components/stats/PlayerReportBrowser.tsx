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

// Same red card as the home page scoreboard and the rolling trend chart.
const CARD_GRADIENT = "linear-gradient(155deg, #c8253f 0%, #7d0f1f 100%)";

// The leader gets the headshot (full portrait, so the whole face shows);
// 2nd through 4th follow as compact rows.
function LeaderCard({ category }: { category: LeaderboardCategory }) {
  const [leader, ...rest] = category.players;

  return (
    <article
      style={{
        borderRadius: "18px",
        background: CARD_GRADIENT,
        color: "#fdfaf3",
        padding: "0.95rem",
        display: "grid",
        gap: "0.75rem",
        alignContent: "start",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.75rem" }}>
        <h3 style={{ margin: 0, fontFamily: "Anton, sans-serif", fontSize: "1.45rem", letterSpacing: "0.03em" }}>
          {category.label}
        </h3>
        <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(253,250,243,0.7)" }}>
          {category.description}
        </span>
      </div>

      {!leader ? (
        <p style={{ margin: 0, color: "rgba(253,250,243,0.75)" }}>No players available for this leaderboard.</p>
      ) : (
        <>
          <Link
            href={`/players/${leader.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "64px minmax(0, 1fr) auto",
              alignItems: "center",
              gap: "0.85rem",
              padding: "0.6rem",
              borderRadius: "14px",
              background: "rgba(253,250,243,0.1)",
              border: "1px solid rgba(253,250,243,0.22)",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <img
              src={leader.imageUrl}
              alt={`Headshot of ${leader.name}`}
              loading="lazy"
              style={{
                width: "64px",
                height: "96px",
                borderRadius: "10px",
                objectFit: "cover",
                objectPosition: "top center",
                background: "rgba(253,250,243,0.15)",
                display: "block",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.1em", color: "#f2c14e" }}>LEADER</p>
              <p style={{ margin: "0.15rem 0 0", fontWeight: 800, fontSize: "1rem", lineHeight: 1.2 }}>{leader.name}</p>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.76rem", color: "rgba(253,250,243,0.72)" }}>{leader.position}</p>
            </div>
            <div style={{ fontFamily: "Anton, sans-serif", fontSize: "2rem", lineHeight: 1, whiteSpace: "nowrap" }}>
              {leader.displayValue}
            </div>
          </Link>

          {rest.length > 0 && (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.15rem" }}>
              {rest.map((player, index) => (
                <li key={`${category.key}-${player.id}`}>
                  <Link
                    href={`/players/${player.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4rem minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.4rem 0.35rem",
                      borderTop: "1px solid rgba(253,250,243,0.16)",
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ fontWeight: 800, color: "rgba(253,250,243,0.65)", fontSize: "0.82rem" }}>{index + 2}</span>
                    <span style={{ minWidth: 0, fontWeight: 700, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {player.name}
                      <span style={{ marginLeft: "0.4rem", fontWeight: 500, fontSize: "0.74rem", color: "rgba(253,250,243,0.65)" }}>
                        {player.position}
                      </span>
                    </span>
                    <span style={{ fontWeight: 800, fontSize: "0.95rem", whiteSpace: "nowrap" }}>{player.displayValue}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </>
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
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {active.categories.map((category) => (
          <LeaderCard key={category.key} category={category} />
        ))}
      </div>
    </div>
  );
}