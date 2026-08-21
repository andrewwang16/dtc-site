import {
  buildStatRow,
  computeAgeAsOf,
  determinePlayerRole,
  getDraftOrSigningInfo,
  getLeagueAverages,
  getPlayerBio,
  getPlayerHandednessSplits,
  getPlayerYearStats,
  getTeamAbbreviation,
  HITTER_COLUMNS,
  PITCHER_COLUMNS,
  playerHeadshotUrl,
  teamLogoUrl,
  type StatRow,
} from "@/lib/mlb";
import RollingTrendChart from "@/components/players/RollingTrendChart";
import GameLogTable from "@/components/players/GameLogTable";
import YearSelect from "@/components/players/YearSelect";
import TeamSplitSelect from "@/components/players/TeamSplitSelect";

type PlayerPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; view?: string; team?: string }>;
};

function StatTable({
  columns,
  rows,
  teamColumn,
}: {
  columns: readonly string[];
  rows: Array<{ label: string; row: StatRow; team?: string }>;
  teamColumn?: boolean;
}) {
  return (
    <div className="stat-table-scroll" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table className="stat-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "0.85rem" }}>
            <th style={{ padding: "0.5rem 0.75rem" }}></th>
            {teamColumn && (
              <th style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap" }}>Team</th>
            )}
            {columns.map((column) => (
              <th key={column} style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap" }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.label} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "0.6rem 0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                {entry.label}
              </td>
              {teamColumn && (
                <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
                  {entry.team ?? "-"}
                </td>
              )}
              {columns.map((column) => (
                <td key={column} style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
                  {entry.row[column] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="kicker" style={{ marginBottom: "0.25rem" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const { id } = await params;
  const { year: yearParam, view: viewParam, team: teamParam } = await searchParams;
  const playerId = Number.parseInt(id, 10);

  const bio = await getPlayerBio(playerId);

  if (!bio) {
    return (
      <div className="container" style={{ paddingTop: "2.2rem", paddingBottom: "4rem" }}>
        <p className="kicker">Player</p>
        <h1 className="section-title">Player not found</h1>
        <p style={{ color: "var(--muted)" }}>
          We couldn&apos;t find a player with that ID.
        </p>
      </div>
    );
  }

  const isTwoWay = bio.primaryPosition?.abbreviation === "TWP";
  const role = isTwoWay
    ? viewParam === "pitching"
      ? "Pitcher"
      : "Hitter"
    : determinePlayerRole(bio);
  const group = role === "Pitcher" ? "pitching" : "hitting";
  const columns = role === "Pitcher" ? PITCHER_COLUMNS : HITTER_COLUMNS;

  const currentYear = new Date().getFullYear();
  // Fall back to a wide, fixed range when a debut date isn't on file, rather
  // than collapsing the dropdown down to just the current year.
  const debutYear = bio.mlbDebutDate
    ? Number.parseInt(bio.mlbDebutDate.slice(0, 4), 10)
    : currentYear - 19;

  const years: number[] = [];
  for (let year = currentYear; year >= debutYear; year -= 1) {
    years.push(year);
  }

  const requestedYear = Number.parseInt(yearParam ?? "", 10);
  const selectedYear = years.includes(requestedYear) ? requestedYear : years[0] ?? currentYear;

  const [yearStats, handednessSplits, league] = await Promise.all([
    getPlayerYearStats(playerId, selectedYear, group),
    getPlayerHandednessSplits(playerId, selectedYear, group),
    getLeagueAverages(selectedYear),
  ]);

  const hasMultipleTeams = yearStats.seasonTeams.length > 1;
  const requestedTeamId = Number.parseInt(teamParam ?? "", 10);
  const selectedTeamStint = hasMultipleTeams
    ? yearStats.seasonTeams.find((team) => team.teamId === requestedTeamId)
    : undefined;

  const seasonStat = selectedTeamStint ? selectedTeamStint.stat : yearStats.season;

  const seasonTeamLabel = selectedTeamStint
    ? getTeamAbbreviation(selectedTeamStint.teamId, selectedTeamStint.teamName)
    : hasMultipleTeams
      ? `${yearStats.seasonTeams.length}TM`
      : yearStats.seasonTeams[0]
        ? getTeamAbbreviation(
            yearStats.seasonTeams[0].teamId,
            yearStats.seasonTeams[0].teamName
          )
        : "-";

  const seasonRow = buildStatRow(role, seasonStat, league);

  const monthRows = yearStats.months.map((month) => ({
    label: month.month,
    row: buildStatRow(role, month.stat, league),
  }));

  const handednessLabel = (code: string) => {
    if (role === "Pitcher") {
      return code === "vl" ? "Vs. LHB" : "Vs. RHB";
    }

    return code === "vl" ? "Vs. LHP" : "Vs. RHP";
  };

  const handednessRows = handednessSplits.map((split) => ({
    label: handednessLabel(split.code),
    row: buildStatRow(role, split.stat, league),
  }));

  const age = computeAgeAsOf(bio.birthDate, `${selectedYear}-07-01`);

  const born = [bio.birthCity, bio.birthStateProvince, bio.birthCountry]
    .filter(Boolean)
    .join(", ");

  const draftInfo = getDraftOrSigningInfo(bio);

  return (
    <div
      style={{
        display: "grid",
        gap: "3.5rem",
        paddingBottom: "4rem",
        paddingTop: "2.2rem",
      }}
    >
      <section className="container fade-up">
        <div
          className="player-header-row"
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            className="player-header-photo"
            style={{
              width: "168px",
              height: "208px",
              borderRadius: "18px",
              overflow: "hidden",
              flexShrink: 0,
              background: "rgba(15,31,61,.08)",
              border: "1px solid var(--line)",
            }}
          >
            <img
              src={playerHeadshotUrl(playerId, 280)}
              alt={bio.fullName}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
              }}
            />
          </div>

          <div className="player-header-name">
            <p className="kicker" style={{ marginBottom: "0.35rem" }}>
              {bio.primaryPosition?.name ?? role} · #{bio.primaryNumber ?? "-"}
            </p>

            <h1 className="section-title">{bio.fullName}</h1>

            {bio.currentTeam ? (
              <div
                className="player-header-team"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  marginTop: "0.6rem",
                }}
              >
                <img
                  src={teamLogoUrl(bio.currentTeam.id)}
                  alt={bio.currentTeam.name}
                  width={28}
                  height={28}
                />
                <span style={{ color: "var(--muted)" }}>{bio.currentTeam.name}</span>
              </div>
            ) : (
              <p style={{ color: "var(--muted)", marginTop: "0.6rem" }}>Free Agent</p>
            )}
          </div>

          <article
            className="player-header-info"
            style={{
              flex: "1 1 320px",
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "var(--panel)",
              padding: "1.15rem",
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <InfoTile label="Age" value={age !== null ? String(age) : "-"} />
            <InfoTile
              label="Bats / Throws"
              value={`${bio.batSide?.code ?? "-"} / ${bio.pitchHand?.code ?? "-"}`}
            />
            <InfoTile
              label="Ht / Wt"
              value={`${bio.height ?? "-"} / ${bio.weight ? `${bio.weight} lbs` : "-"}`}
            />
            <InfoTile
              label="Born"
              value={`${bio.birthDate ?? "-"}${born ? ` · ${born}` : ""}`}
            />
            <InfoTile
              label={draftInfo?.kind === "signed" ? "Signed" : "Drafted"}
              value={
                draftInfo
                  ? `${draftInfo.team}${draftInfo.detail ? ` — ${draftInfo.detail}` : ""}`
                  : bio.draftYear
                    ? String(bio.draftYear)
                    : "-"
              }
            />
          </article>
        </div>
      </section>

      <section
        className="container fade-up"
        style={{ animationDelay: "0.08s" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ margin: 0 }}>Season Stats</h2>

          <div className="player-header-controls" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {isTwoWay && (
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <a
                  href={`/players/${playerId}?year=${selectedYear}&view=hitting`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.55rem 1rem",
                    borderRadius: "999px",
                    border: `1px solid ${role === "Hitter" ? "#8a1024" : "var(--line)"}`,
                    background:
                      role === "Hitter" ? "rgba(196,30,58,0.18)" : "rgba(15,31,61,0.02)",
                    color: "var(--text)",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Hitting
                </a>
                <a
                  href={`/players/${playerId}?year=${selectedYear}&view=pitching`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.55rem 1rem",
                    borderRadius: "999px",
                    border: `1px solid ${role === "Pitcher" ? "#8a1024" : "var(--line)"}`,
                    background:
                      role === "Pitcher" ? "rgba(196,30,58,0.18)" : "rgba(15,31,61,0.02)",
                    color: "var(--text)",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Pitching
                </a>
              </div>
            )}

            {hasMultipleTeams && (
              <TeamSplitSelect
                playerId={playerId}
                year={selectedYear}
                view={isTwoWay ? (role === "Pitcher" ? "pitching" : "hitting") : undefined}
                teams={yearStats.seasonTeams.map((team) => ({
                  id: team.teamId,
                  label: getTeamAbbreviation(team.teamId, team.teamName),
                }))}
                selectedTeamId={selectedTeamStint?.teamId ?? null}
              />
            )}

            <YearSelect
              playerId={playerId}
              years={years}
              selectedYear={selectedYear}
              view={isTwoWay ? (role === "Pitcher" ? "pitching" : "hitting") : undefined}
            />
          </div>
        </div>

        <StatTable
          columns={columns}
          teamColumn
          rows={[{ label: String(selectedYear), row: seasonRow, team: seasonTeamLabel }]}
        />
      </section>

      <section
        className="container fade-up"
        style={{ animationDelay: "0.11s" }}
      >
        <h2 style={{ margin: "0 0 1rem" }}>Splits by Month</h2>
        {monthRows.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No monthly data for {selectedYear}.</p>
        ) : (
          <StatTable columns={columns} rows={monthRows} />
        )}
      </section>

      <section
        className="container fade-up"
        style={{ animationDelay: "0.14s" }}
      >
        <h2 style={{ margin: "0 0 1rem" }}>Splits by Handedness</h2>
        {handednessRows.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No handedness splits for {selectedYear}.</p>
        ) : (
          <StatTable columns={columns} rows={handednessRows} />
        )}
      </section>

      <section
        className="container fade-up"
        style={{ animationDelay: "0.17s" }}
      >
        <h2 style={{ margin: "0 0 1rem" }}>Rolling Trend</h2>
        <article
          style={{
            border: "1px solid var(--line)",
            borderRadius: "18px",
            background: "var(--panel)",
            padding: "1.15rem",
          }}
        >
          <RollingTrendChart gameLog={yearStats.gameLog} role={role} league={league} />
        </article>
      </section>

      <section
        className="container fade-up"
        style={{ animationDelay: "0.2s" }}
      >
        <h2 style={{ margin: "0 0 1rem" }}>Game Log</h2>
        <article
          style={{
            border: "1px solid var(--line)",
            borderRadius: "18px",
            background: "var(--panel)",
            padding: "1.15rem",
          }}
        >
          <GameLogTable gameLog={yearStats.gameLog} />
        </article>
      </section>
    </div>
  );
}
