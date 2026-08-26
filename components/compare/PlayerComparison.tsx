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
  getLeagueAverages,
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

async function loadComparisonSide(playerId: number, year: number): Promise<ComparisonSide | null> {
  const bio = await getPlayerBio(playerId);

  if (!bio) {
    return null;
  }

  const role = determinePlayerRole(bio);
  const group = role === "Pitcher" ? "pitching" : "hitting";
  const columns = role === "Pitcher" ? PITCHER_COLUMNS : HITTER_COLUMNS;

  const [{ season }, league] = await Promise.all([
    getPlayerYearStats(playerId, year, group),
    getLeagueAverages(year),
  ]);

  return {
    bio,
    role,
    columns,
    row: buildStatRow(role, season, league),
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
            <thead>
              <tr style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}></th>
                <th style={{ padding: "0.5rem 0.75rem" }}>{sideA ? sideA.bio.fullName : "-"}</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>{sideB ? sideB.bio.fullName : "-"}</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((column) => (
                <tr key={column} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700, color: "var(--muted)" }}>{column}</td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700 }}>
                    {sideA?.row[column] ?? "-"}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700 }}>
                    {sideB?.row[column] ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
