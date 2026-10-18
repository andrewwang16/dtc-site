import Link from "next/link";
import PlayerHeadshot from "@/components/shared/PlayerHeadshot";
import TeamLogo from "@/components/shared/TeamLogo";
import {
  AL_LEAGUE_ID,
  buildStatRow,
  computeAgeAsOf,
  determinePlayerRole,
  getCardinalsRoster,
  getColumnRanks,
  getPlayerBio,
  getPlayerCareerYears,
  getPlayerSituationSplits,
  getPlayerAwards,
  formatAwardSeasons,
  getPlayerYearStats,
  getTeamAbbreviation,
  HITTER_COLUMNS,
  HITTER_HANDEDNESS_COLUMNS,
  NL_LEAGUE_ID,
  PITCHER_COLUMNS,
  PITCHER_HANDEDNESS_COLUMNS,
  playerHeadshotUrl,
  teamLogoUrl,
  type RosterEntry,
  type StatLine,
  type StatRow,
} from "@/lib/mlb";
import { getPlayerGrades } from "@/lib/grades";
import { getPodcastMentionsForPlayer } from "@/lib/podcast-mentions";
import { getStatcastPercentiles, isAmericanLeagueTeam, isNationalLeagueTeam } from "@/lib/statcast";
import { computeEraPlus, computeWrcPlus, formatPlusStat, getSeasonEnvironment } from "@/lib/park-adjusted";
import {
  formatWar,
  getPitcherSplitWar,
  getPitcherWar,
  getPositionPlayerSplitWar,
  getPositionPlayerWar,
} from "@/lib/war";
import RollingTrendChart from "@/components/players/RollingTrendChart";
import GameLogTable from "@/components/players/GameLogTable";
import YearSelect from "@/components/players/YearSelect";
import TeamSplitSelect from "@/components/players/TeamSplitSelect";
import PlayerSearch from "@/components/players/PlayerSearch";
import PlayerGrades from "@/components/players/PlayerGrades";
import PodcastMentions from "@/components/players/PodcastMentions";
import StatcastPercentiles from "@/components/players/StatcastPercentiles";
import PlayerStatsPanel, { type StatsView } from "@/components/players/PlayerStatsPanel";
import SeasonStatCells from "@/components/players/SeasonStatCells";
import SplitsPanel from "@/components/players/SplitsPanel";

type PlayerPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; view?: string; team?: string; stats?: string }>;
};

function StatTable({
  columns,
  rows,
  teamColumn,
  highlighted = [],
}: {
  columns: readonly string[];
  rows: Array<{ label: string; row: StatRow; team?: string }>;
  teamColumn?: boolean;
  // Columns tinted like the featured season cells (WAR, wRC+/ERA+).
  highlighted?: readonly string[];
}) {
  const highlightStyle = (column: string): React.CSSProperties =>
    highlighted.includes(column) ? { background: "rgba(196,30,58,0.06)", fontWeight: 700 } : {};

  const stickyFirstColStyle: React.CSSProperties = {
    position: "sticky",
    left: 0,
    background: "var(--panel)",
    borderRight: "1px solid var(--line)",
    zIndex: 1,
  };

  return (
    <div className="stat-table-scroll" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table className="stat-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "0.85rem" }}>
            <th style={{ padding: "0.5rem 0.75rem", ...stickyFirstColStyle }}></th>
            {teamColumn && (
              <th style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap" }}>Team</th>
            )}
            {columns.map((column) => (
              <th key={column} style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap", ...highlightStyle(column) }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.label} style={{ borderTop: "1px solid var(--line)" }}>
              <td
                style={{
                  padding: "0.6rem 0.75rem",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  ...stickyFirstColStyle,
                }}
              >
                {entry.label}
              </td>
              {teamColumn && (
                <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>
                  {entry.team ?? "-"}
                </td>
              )}
              {columns.map((column) => (
                <td key={column} style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap", ...highlightStyle(column) }}>
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

function PlayerPageTopBar({ roster }: { roster: RosterEntry[] }) {
  return (
    <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.5rem" }}>
      <Link
        href="/roster"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontWeight: 700,
          color: "var(--accent-soft)",
        }}
      >
        ← Back to Roster
      </Link>

      <PlayerSearch roster={roster} />
    </div>
  );
}

function formatRuns(value: number) {
  const rounded = value.toFixed(1);
  return value > 0 ? `+${rounded}` : rounded;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="kicker" style={{ marginBottom: "0.25rem" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</p>
    </div>
  );
}

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const { id } = await params;
  const { year: yearParam, view: viewParam, team: teamParam, stats: statsParam } = await searchParams;
  const statsView: StatsView = statsParam === "statcast" ? "statcast" : "standard";
  const statsQuery = statsView === "statcast" ? "&stats=statcast" : "";
  const playerId = Number.parseInt(id, 10);

  const [bio, roster] = await Promise.all([getPlayerBio(playerId), getCardinalsRoster(new Date().getFullYear())]);

  if (!bio) {
    return (
      <div className="container" style={{ paddingTop: "2.2rem", paddingBottom: "4rem" }}>
        <PlayerPageTopBar roster={roster} />
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
  const handednessColumns = role === "Pitcher" ? PITCHER_HANDEDNESS_COLUMNS : HITTER_HANDEDNESS_COLUMNS;

  const currentYear = new Date().getFullYear();
  // Fall back to a wide, fixed range when a debut date isn't on file, rather
  // than collapsing the dropdown down to just the current year.
  const debutYear = bio.mlbDebutDate
    ? Number.parseInt(bio.mlbDebutDate.slice(0, 4), 10)
    : currentYear - 19;

  const careerYears = await getPlayerCareerYears(playerId, group);

  const years: number[] = [];
  for (let year = currentYear; year >= debutYear; year -= 1) {
    // Keep the current year regardless (a rookie's debut season may not
    // show up in yearByYear yet) and fall back to the full range if the
    // fetch failed outright, rather than collapsing the dropdown to empty.
    if (careerYears.size === 0 || careerYears.has(year) || year === currentYear) {
      years.push(year);
    }
  }

  const requestedYear = Number.parseInt(yearParam ?? "", 10);
  const selectedYear = years.includes(requestedYear) ? requestedYear : years[0] ?? currentYear;

  const statcastType = role === "Pitcher" ? "pitcher" : "batter";

  const [yearStats, situationSplits, playerGrades, podcastMentions, statcastMetrics, seasonEnvironment, awards] =
    await Promise.all([
      getPlayerYearStats(playerId, selectedYear, group),
      getPlayerSituationSplits(playerId, selectedYear, group, ["vl", "vr", "h", "a"]),
      getPlayerGrades(bio.fullName),
      getPodcastMentionsForPlayer(bio.fullName),
      getStatcastPercentiles(playerId, selectedYear, statcastType),
      getSeasonEnvironment(selectedYear),
      getPlayerAwards(playerId),
    ]);

  // A player traded across leagues mid-season doesn't fit either league's
  // own leaderboard, so rank them MLB-wide instead; a player who stayed in
  // one league all year (even across teams, e.g. an in-league trade) gets
  // ranked within that league.
  function teamLeague(teamId: number): "AL" | "NL" | null {
    if (isNationalLeagueTeam(teamId)) return "NL";
    if (isAmericanLeagueTeam(teamId)) return "AL";
    return null;
  }

  const teamIdsThisSeason =
    yearStats.seasonTeams.length > 0
      ? yearStats.seasonTeams.map((team) => team.teamId)
      : bio.currentTeam
        ? [bio.currentTeam.id]
        : [];

  const leaguesThisSeason = new Set(
    teamIdsThisSeason.map(teamLeague).filter((league): league is "AL" | "NL" => league !== null)
  );

  const rankScope: "NL" | "AL" | "MLB" | null =
    leaguesThisSeason.size > 1 ? "MLB" : leaguesThisSeason.size === 1 ? [...leaguesThisSeason][0] : null;

  const rankLeagueId = rankScope === "NL" ? NL_LEAGUE_ID : rankScope === "AL" ? AL_LEAGUE_ID : undefined;

  const columnRanks = rankScope ? await getColumnRanks(playerId, selectedYear, role, rankLeagueId) : {};

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

  const seasonRow = buildStatRow(role, seasonStat);

  const seasonStints = selectedTeamStint ? [selectedTeamStint] : yearStats.seasonTeams;
  const plusColumn = role === "Pitcher" ? "ERA+" : "wRC+";
  // Park-adjusted stats only make sense on a full season (or team stint)
  // line, so they lead the season cells but stay out of the split tables.
  const featuredColumns = ["WAR", plusColumn];
  const seasonColumns = [...featuredColumns, ...columns];

  const [positionPlayerWar, pitcherWar] = await Promise.all([
    role === "Pitcher"
      ? null
      : getPositionPlayerWar(
          playerId,
          selectedYear,
          seasonStat,
          seasonStints,
          yearStats.season?.plateAppearances ?? 0
        ),
    role === "Pitcher" ? getPitcherWar(selectedYear, seasonStat, seasonStints) : null,
  ]);

  seasonRow.WAR = formatWar(role === "Pitcher" ? pitcherWar?.war : positionPlayerWar?.war);

  // Shown on hover over the WAR cell.
  const warBreakdown = positionPlayerWar
    ? [
        `Batting ${formatRuns(positionPlayerWar.batting)} runs`,
        `Baserunning ${formatRuns(positionPlayerWar.baserunning)} runs`,
        positionPlayerWar.hasStatcast
          ? `Fielding ${formatRuns(positionPlayerWar.fielding)} runs`
          : "Fielding n/a (Statcast starts in 2016)",
        `Positional ${formatRuns(positionPlayerWar.positional)} runs`,
        `League ${formatRuns(positionPlayerWar.league)} runs`,
        `Replacement ${formatRuns(positionPlayerWar.replacement)} runs`,
      ]
    : pitcherWar
      ? [
          `RA9 ${pitcherWar.ra9.toFixed(2)}`,
          `Park-adjusted RA9 ${pitcherWar.parkAdjustedRa9.toFixed(2)}`,
          `League RA9 ${pitcherWar.leagueRa9.toFixed(2)}`,
          ...(pitcherWar.gmLI !== null ? [`Est. leverage ${pitcherWar.gmLI.toFixed(2)}`] : []),
        ]
      : [];

  const featuredTooltips: Record<string, string> = {
    WAR: [
      role === "Pitcher"
        ? "Wins above replacement, based on runs allowed (RA9), park- and league-adjusted."
        : "Wins above replacement, park- and league-adjusted, FanGraphs-style.",
      ...warBreakdown,
    ].join("\n"),
    [plusColumn]: "Adjusts for ballpark and league; 100 is league average and higher is better.",
  };

  seasonRow[plusColumn] = seasonEnvironment
    ? formatPlusStat(
        role === "Pitcher"
          ? computeEraPlus(seasonStat, seasonStints, seasonEnvironment)
          : computeWrcPlus(seasonStat, seasonStints, seasonEnvironment)
      )
    : "-";

  const handednessLabel = (code: string) => {
    if (role === "Pitcher") {
      return code === "vl" ? "Vs. LHB" : "Vs. RHB";
    }

    return code === "vl" ? "Vs. LHP" : "Vs. RHP";
  };

  const splitByCode = new Map(situationSplits.map((split) => [split.code, split.stat]));
  const splitGroups = {
    month: yearStats.months.map((month) => ({ label: month.month, stat: month.stat })),
    handedness: ["vl", "vr"].flatMap((code) => {
      const stat = splitByCode.get(code);
      return stat ? [{ label: handednessLabel(code), stat }] : [];
    }),
    venue: [
      { code: "h", label: "Home" },
      { code: "a", label: "Away" },
    ].flatMap(({ code, label }) => {
      const stat = splitByCode.get(code);
      return stat ? [{ label, stat }] : [];
    }),
  };

  // Splits cover the whole season whatever team is picked above, so their
  // WAR and wRC+/ERA+ use every stint's park and league context.
  const splitEntries = [...splitGroups.month, ...splitGroups.handedness, ...splitGroups.venue];
  const splitWars =
    role === "Pitcher"
      ? await getPitcherSplitWar(
          selectedYear,
          splitEntries.map((entry) => entry.stat),
          yearStats.seasonTeams
        )
      : await getPositionPlayerSplitWar(
          playerId,
          selectedYear,
          splitEntries.map((entry) => entry.stat),
          yearStats.seasonTeams,
          yearStats.season?.plateAppearances ?? 0
        );
  const splitWarByStat = new Map(splitEntries.map((entry, index) => [entry.stat, splitWars[index]]));

  const buildSplitRows = (entries: Array<{ label: string; stat: StatLine }>) =>
    entries.map((entry) => {
      const row = buildStatRow(role, entry.stat);
      row.WAR = formatWar(splitWarByStat.get(entry.stat));
      row[plusColumn] = seasonEnvironment
        ? formatPlusStat(
            role === "Pitcher"
              ? computeEraPlus(entry.stat, yearStats.seasonTeams, seasonEnvironment)
              : computeWrcPlus(entry.stat, yearStats.seasonTeams, seasonEnvironment)
          )
        : "-";
      return { label: entry.label, row };
    });

  const splitColumns = [...featuredColumns, ...columns];
  // Pitching splits by batter hand have no runs allowed, so WAR and ERA+
  // can't be computed there.
  const handednessSplitColumns = role === "Pitcher" ? handednessColumns : [...featuredColumns, ...handednessColumns];

  const splitOptions = [
    { key: "month", label: "By Month", empty: "monthly", columns: splitColumns, rows: buildSplitRows(splitGroups.month) },
    {
      key: "handedness",
      label: "By Handedness",
      empty: "handedness",
      columns: handednessSplitColumns,
      rows: buildSplitRows(splitGroups.handedness),
    },
    { key: "venue", label: "Home / Away", empty: "home/away", columns: splitColumns, rows: buildSplitRows(splitGroups.venue) },
  ];

  const age = computeAgeAsOf(bio.birthDate, `${selectedYear}-07-01`);

  const born = [bio.birthCity, bio.birthStateProvince, bio.birthCountry]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="player-page-root"
      style={{
        display: "grid",
        gap: "1.75rem",
        paddingBottom: "4rem",
        paddingTop: "2.2rem",
      }}
    >
      <section className="container fade-up player-page-section player-page-topbar">
        <PlayerPageTopBar roster={roster} />
      </section>

      <section className="container fade-up player-page-section">
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
            <PlayerHeadshot
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
                <TeamLogo
                  src={teamLogoUrl(bio.currentTeam.id)}
                  alt={bio.currentTeam.name}
                  style={{ width: 28, height: 28 }}
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
              display: "flex",
              flexWrap: "wrap",
              gap: "1.25rem",
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

            {/* Major career honors from the MLB Stats API (no section if none). */}
            {awards.length > 0 && (
              <div style={{ flexBasis: "100%", display: "grid", gap: "0.45rem" }}>
                <p className="kicker" style={{ marginBottom: 0 }}>
                  Awards
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {awards.map((award) => (
                    <span
                      key={award.label}
                      title={`${award.label}: ${award.seasons.join(", ")}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        gap: "0.35rem",
                        padding: "0.3rem 0.7rem",
                        borderRadius: "999px",
                        border: "1px solid #e3c46f",
                        background: "rgba(242,193,78,0.14)",
                        fontSize: "0.82rem",
                      }}
                    >
                      <strong>
                        {award.seasons.length > 1 ? `${award.seasons.length}× ` : ""}
                        {award.label}
                      </strong>
                      <span style={{ color: "var(--muted)", fontSize: "0.76rem" }}>
                        {formatAwardSeasons(award.seasons)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </section>

      <section
        className="container fade-up player-page-section"
        style={{ animationDelay: "0.08s" }}
      >
        <PlayerStatsPanel
          initialView={statsView}
          controls={
            <>
              {isTwoWay && (
                <div style={{ display: "flex", gap: "0.4rem" }}>
                <a
                  href={`/players/${playerId}?year=${selectedYear}&view=hitting${statsQuery}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.55rem 1rem",
                    borderRadius: "999px",
                    border: `1px solid ${role === "Hitter" ? "#fdfaf3" : "rgba(253,250,243,0.4)"}`,
                    background: role === "Hitter" ? "#fdfaf3" : "rgba(253,250,243,0.12)",
                    color: role === "Hitter" ? "#a8172f" : "#fdfaf3",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Hitting
                </a>
                <a
                  href={`/players/${playerId}?year=${selectedYear}&view=pitching${statsQuery}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.55rem 1rem",
                    borderRadius: "999px",
                    border: `1px solid ${role === "Pitcher" ? "#fdfaf3" : "rgba(253,250,243,0.4)"}`,
                    background: role === "Pitcher" ? "#fdfaf3" : "rgba(253,250,243,0.12)",
                    color: role === "Pitcher" ? "#a8172f" : "#fdfaf3",
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
            </>
          }
          standard={
            <>
              <p style={{ margin: "0 0 0.85rem", color: "rgba(253,250,243,0.8)", fontSize: "0.85rem" }}>
                {selectedYear} · {seasonTeamLabel}
              </p>
              <SeasonStatCells
                columns={seasonColumns}
                row={seasonRow}
                ranks={columnRanks}
                scope={rankScope}
                highlighted={featuredColumns}
                tooltips={featuredTooltips}
              />
            </>
          }
          statcast={
            <>
              <p style={{ margin: "0 0 0.85rem", color: "rgba(253,250,243,0.8)", fontSize: "0.85rem" }}>
                {selectedYear} · MLB percentile ranks
              </p>
              <StatcastPercentiles metrics={statcastMetrics} />
            </>
          }
        />
      </section>

      <section
        className="container fade-up player-page-section"
        style={{ animationDelay: "0.11s" }}
      >
        <SplitsPanel
          options={splitOptions.map((option) => ({
            key: option.key,
            label: option.label,
            content:
              option.rows.length === 0 ? (
                <p style={{ margin: 0, color: "var(--muted)" }}>
                  No {option.empty} splits for {selectedYear}.
                </p>
              ) : (
                <StatTable columns={option.columns} rows={option.rows} highlighted={featuredColumns} />
              ),
          }))}
        />
      </section>

      <section
        className="container fade-up player-page-section"
        style={{ animationDelay: "0.17s" }}
      >
        <h2 className="player-section-title" style={{ margin: "0 0 1rem" }}>Rolling Trend</h2>
        <article
          className="rolling-trend-card"
          style={{
            border: "1px solid var(--line)",
            borderRadius: "18px",
            // Same red as the home page scoreboard.
            background: "linear-gradient(155deg, #c8253f 0%, #7d0f1f 100%)",
            color: "#fdfaf3",
            padding: "1.15rem",
          }}
        >
          <RollingTrendChart
            gameLog={yearStats.gameLog}
            role={role}
            rollingContext={positionPlayerWar?.rollingContext ?? pitcherWar?.rollingContext ?? null}
          />
        </article>
      </section>

      <section
        className="container fade-up player-page-section"
        style={{ animationDelay: "0.2s" }}
      >
        <h2 className="player-section-title" style={{ margin: "0 0 1rem" }}>Game Log</h2>
        <article
          className="game-log-card"
          style={{
            border: "1px solid var(--line)",
            borderRadius: "18px",
            background: "var(--panel)",
            padding: "1.15rem",
          }}
        >
          <GameLogTable gameLog={yearStats.gameLog} role={role} />
        </article>
      </section>

      {playerGrades.length > 0 && (
        <section
          className="container fade-up player-page-section"
          style={{ animationDelay: "0.21s", minWidth: 0 }}
        >
          <h2 className="player-section-title" style={{ margin: "0 0 1rem" }}>Monthly Grades</h2>
          <PlayerGrades grades={playerGrades} />
        </section>
      )}

      {podcastMentions.length > 0 && (
        <section
          className="container fade-up player-page-section"
          style={{ animationDelay: "0.26s", minWidth: 0 }}
        >
          <h2 className="player-section-title" style={{ margin: "0 0 1rem" }}>Podcast Features</h2>
          <PodcastMentions mentions={podcastMentions} />
        </section>
      )}
    </div>
  );
}
