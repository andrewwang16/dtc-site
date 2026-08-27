"use client";

import { useState } from "react";
import Link from "next/link";
import PlayerPicker from "@/components/articles/PlayerPicker";
import PlayerHeadshot from "@/components/shared/PlayerHeadshot";
import TeamLogo from "@/components/shared/TeamLogo";
import {
  buildStatRow,
  computeAgeAsOf,
  determinePlayerRole,
  getPlayerBio,
  getPlayerYearStats,
  getTeamAbbreviation,
  HITTER_COLUMNS,
  PITCHER_COLUMNS,
  playerHeadshotUrl,
  teamLogoUrl,
  type PlayerBio,
  type PlayerRole,
  type RosterEntry,
  type StatRow,
} from "@/lib/mlb";

type ComparisonSide = {
  bio: PlayerBio;
  role: PlayerRole;
  columns: readonly string[];
  row: StatRow;
  age: number | null;
};

// W-L is a compound "12-5" string, not a single number, so it's excluded
// from both sets below and never highlighted.
const HIGHER_IS_BETTER_HITTER = new Set([
  "G", "PA", "AVG", "OBP", "SLG", "OPS", "HR", "XBH", "RBI", "SB", "ISO", "BB%",
]);
const LOWER_IS_BETTER_HITTER = new Set(["K%"]);

const HIGHER_IS_BETTER_PITCHER = new Set(["G", "GS", "SV", "IP", "K", "K%", "K-BB%"]);
const LOWER_IS_BETTER_PITCHER = new Set(["ERA", "WHIP", "BB", "BB%", "HR/9"]);

function parseComparableValue(raw: string): number | null {
  if (raw === "-") {
    return null;
  }

  const num = Number.parseFloat(raw.replace("%", ""));
  return Number.isFinite(num) ? num : null;
}

// Only meaningful when both players share the same role — the same column
// label (e.g. "K%" or "OPS+") points at opposite things for a hitter vs a
// pitcher, so a mixed comparison can't say who's "better" at it.
function betterSide(column: string, role: PlayerRole, rawA: string, rawB: string): "A" | "B" | null {
  const higherSet = role === "Pitcher" ? HIGHER_IS_BETTER_PITCHER : HIGHER_IS_BETTER_HITTER;
  const lowerSet = role === "Pitcher" ? LOWER_IS_BETTER_PITCHER : LOWER_IS_BETTER_HITTER;

  if (!higherSet.has(column) && !lowerSet.has(column)) {
    return null;
  }

  const a = parseComparableValue(rawA);
  const b = parseComparableValue(rawB);

  if (a === null || b === null || a === b) {
    return null;
  }

  const aIsBetter = higherSet.has(column) ? a > b : a < b;
  return aIsBetter ? "A" : "B";
}

async function loadComparisonSide(playerId: number, year: number): Promise<ComparisonSide | null> {
  const bio = await getPlayerBio(playerId);

  if (!bio) {
    return null;
  }

  const role = determinePlayerRole(bio);
  const group = role === "Pitcher" ? "pitching" : "hitting";
  const columns = role === "Pitcher" ? PITCHER_COLUMNS : HITTER_COLUMNS;

  const { season } = await getPlayerYearStats(playerId, year, group);

  return {
    bio,
    role,
    columns,
    row: buildStatRow(role, season),
    age: computeAgeAsOf(bio.birthDate, `${year}-07-01`),
  };
}

function PlayerHeader({ side }: { side: ComparisonSide }) {
  const { bio, role, age } = side;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", textAlign: "center" }}>
      <div
        style={{
          width: "88px",
          height: "88px",
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "rgba(15,31,61,.08)",
          border: "1px solid var(--line)",
        }}
      >
        <PlayerHeadshot
          src={playerHeadshotUrl(bio.id, 176)}
          alt={bio.fullName}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
        />
      </div>

      <Link href={`/players/${bio.id}`} style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)" }}>
        {bio.fullName}
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--muted)", fontSize: "0.85rem" }}>
        {bio.currentTeam && (
          <>
            <TeamLogo src={teamLogoUrl(bio.currentTeam.id)} alt="" style={{ width: 16, height: 16 }} />
            <span>{getTeamAbbreviation(bio.currentTeam.id, bio.currentTeam.name)}</span>
            <span>·</span>
          </>
        )}
        <span>{bio.primaryPosition?.abbreviation ?? role}</span>
        {age !== null && (
          <>
            <span>·</span>
            <span>{age} yrs</span>
          </>
        )}
      </div>
    </div>
  );
}

function ComparisonSlot({
  pool,
  side,
  loading,
  placeholder,
  onSelect,
  onClear,
}: {
  pool: RosterEntry[];
  side: ComparisonSide | null;
  loading: boolean;
  placeholder: string;
  onSelect: (player: RosterEntry) => void;
  onClear: () => void;
}) {
  if (loading) {
    return (
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "1.15rem",
          textAlign: "center",
          color: "var(--muted)",
        }}
      >
        Loading stats...
      </div>
    );
  }

  if (side) {
    return (
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
        <PlayerHeader side={side} />
        <button
          type="button"
          onClick={onClear}
          style={{
            justifySelf: "center",
            border: "1px solid var(--line)",
            background: "rgba(15,31,61,0.02)",
            color: "#b42318",
            fontWeight: 700,
            borderRadius: "999px",
            padding: "0.35rem 0.9rem",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Remove
        </button>
      </div>
    );
  }

  return <PlayerPicker roster={pool} selected={null} onSelect={onSelect} onClear={onClear} placeholder={placeholder} />;
}

export default function PlayerComparison({
  cardinalsPlayers,
  externalPlayers,
  year,
}: {
  cardinalsPlayers: RosterEntry[];
  externalPlayers: RosterEntry[];
  year: number;
}) {
  const [sideA, setSideA] = useState<ComparisonSide | null>(null);
  const [sideB, setSideB] = useState<ComparisonSide | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  async function selectA(player: RosterEntry) {
    setLoadingA(true);
    const loaded = await loadComparisonSide(player.id, year);
    setSideA(loaded);
    setLoadingA(false);
  }

  async function selectB(player: RosterEntry) {
    setLoadingB(true);
    const loaded = await loadComparisonSide(player.id, year);
    setSideB(loaded);
    setLoadingB(false);
  }

  const columns: string[] = [];
  const seenColumns = new Set<string>();
  for (const column of [...(sideA?.columns ?? []), ...(sideB?.columns ?? [])]) {
    if (!seenColumns.has(column)) {
      seenColumns.add(column);
      columns.push(column);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <p className="kicker" style={{ marginBottom: "0.6rem" }}>
            Cardinals System
          </p>
          <ComparisonSlot
            pool={cardinalsPlayers}
            side={sideA}
            loading={loadingA}
            placeholder="Search Cardinals players and prospects..."
            onSelect={selectA}
            onClear={() => setSideA(null)}
          />
        </div>

        <div>
          <p className="kicker" style={{ marginBottom: "0.6rem" }}>
            Anyone in MLB
          </p>
          <ComparisonSlot
            pool={externalPlayers}
            side={sideB}
            loading={loadingB}
            placeholder="Search any MLB player..."
            onSelect={selectB}
            onClear={() => setSideB(null)}
          />
        </div>
      </div>

      {(sideA || sideB) && columns.length > 0 && (
        <div>
        <p className="kicker" style={{ marginBottom: "0.6rem" }}>
          {year} Season
        </p>
        <div className="stat-table-scroll" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="stat-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "420px" }}>
            <colgroup>
              <col style={{ width: "42%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "42%" }} />
            </colgroup>
            <thead>
              <tr style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                <th style={{ padding: "0.5rem 0.75rem" }}>{sideA ? sideA.bio.fullName : "-"}</th>
                <th style={{ padding: "0.5rem 0.75rem" }}></th>
                <th style={{ padding: "0.5rem 0.75rem" }}>{sideB ? sideB.bio.fullName : "-"}</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((column) => {
                const rawA = sideA?.row[column] ?? "-";
                const rawB = sideB?.row[column] ?? "-";
                const winner =
                  sideA && sideB && sideA.role === sideB.role
                    ? betterSide(column, sideA.role, rawA, rawB)
                    : null;

                const winnerStyle: React.CSSProperties = {
                  background: "rgba(15,122,56,0.12)",
                  color: "#0f7a38",
                };

                return (
                  <tr key={column} style={{ borderTop: "1px solid var(--line)" }}>
                    <td
                      style={{
                        padding: "0.5rem 0.75rem",
                        textAlign: "center",
                        fontWeight: 700,
                        borderRadius: "10px 0 0 10px",
                        ...(winner === "A" ? winnerStyle : {}),
                      }}
                    >
                      {rawA}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 0.75rem",
                        textAlign: "center",
                        fontWeight: 700,
                        color: "var(--muted)",
                        fontSize: "0.8rem",
                      }}
                    >
                      {column}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 0.75rem",
                        textAlign: "center",
                        fontWeight: 700,
                        borderRadius: "0 10px 10px 0",
                        ...(winner === "B" ? winnerStyle : {}),
                      }}
                    >
                      {rawB}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
