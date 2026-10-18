import PlayerReportBrowser from "../../components/stats/PlayerReportBrowser";
import type { StatLine } from "@/lib/mlb";
import { computeEraPlus, computeWrcPlus, getSeasonEnvironment } from "@/lib/park-adjusted";
import { getPitcherWar, getPositionPlayerWar } from "@/lib/war";
import type {
  LeaderboardCategory,
  LeaderboardPlayer,
  LeaderboardTabData,
  SeasonStatLine,
  StatsLeadersPageData,
  TeamPlayerSeason,
} from "../../components/stats/playerReportTypes";

type RosterEntry = {
  person: {
    id: number;
    fullName: string;
  };
  position: {
    abbreviation?: string;
  };
};

type RosterResponse = {
  roster?: RosterEntry[];
};

const CARDINALS_TEAM_ID = 138;

function formatNumber(value: number | string | undefined) {
  if (value === undefined || value === null || value === "") {
    return "—";
  }

  return String(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function inningsToOuts(innings: string | undefined) {
  if (!innings) {
    return 0;
  }

  const [whole, fraction = "0"] = innings.split(".");
  const wholePart = Number(whole) * 3;
  const fractionalPart = fraction === "1" ? 1 : fraction === "2" ? 2 : 0;

  return wholePart + fractionalPart;
}

function getPlayerHeadshotUrl(playerId: number) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_200,q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

function selectPlayer(player: TeamPlayerSeason) {
  return player.role === "Pitcher" ? player.pitching : player.hitting;
}

function buildLeaderboardCategory(
  players: TeamPlayerSeason[],
  options: {
    key: string;
    label: string;
    description: string;
    sortDirection: "asc" | "desc";
    qualified: boolean;
    pool: "hitting" | "pitching";
    selectValue: (player: TeamPlayerSeason) => number | null;
    displayValue: (player: TeamPlayerSeason) => string;
    isQualified: (player: TeamPlayerSeason) => boolean;
  }
): LeaderboardCategory {
  const eligiblePlayers = options.qualified ? players.filter(options.isQualified) : players;
  const rankedPlayers = eligiblePlayers
    .map((player) => {
      const sortValue = options.selectValue(player);

      if (sortValue === null || Number.isNaN(sortValue)) {
        return null;
      }

      const statLine = selectPlayer(player);

      if (!statLine) {
        return null;
      }

      return {
        id: player.id,
        name: player.name,
        position: player.position,
        imageUrl: player.imageUrl,
        displayValue: options.displayValue(player),
        sortValue,
      } satisfies LeaderboardPlayer;
    })
    .filter((player): player is LeaderboardPlayer => player !== null)
    .sort((left, right) =>
      options.sortDirection === "asc" ? left.sortValue - right.sortValue : right.sortValue - left.sortValue
    )
    .slice(0, 4);

  return {
    key: options.key,
    label: options.label,
    description: options.description,
    sortDirection: options.sortDirection,
    qualified: options.qualified,
    players: rankedPlayers,
  };
}

// Games the Cardinals actually played (MLB's team totals) — the schedule
// also lists postponed games, which would inflate the qualifying bars.
async function loadTeamGamesPlayed(year: number) {
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/teams/${CARDINALS_TEAM_ID}/stats?stats=season&group=hitting&season=${year}`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    return 0;
  }

  const data = (await response.json()) as { stats?: Array<{ splits?: Array<{ stat?: { gamesPlayed?: number } }> }> };
  return data.stats?.[0]?.splits?.[0]?.stat?.gamesPlayed ?? 0;
}

type PlayerSeasonSplits = {
  stats?: Array<{
    group?: { displayName?: string };
    splits?: Array<{ team?: { id?: number }; stat?: SeasonStatLine & StatLine }>;
  }>;
};

// A player's Cardinals-only line for a group, and his full-season line. A
// player who spent part of the year elsewhere gets one split per team plus
// a combined one; only the Cardinals split counts on these leaderboards.
function cardinalsSplits(data: PlayerSeasonSplits, group: "hitting" | "pitching") {
  const splits = data.stats?.find((entry) => entry.group?.displayName === group)?.splits ?? [];
  const cardinals = splits.find((split) => split.team?.id === CARDINALS_TEAM_ID)?.stat;
  const combined = splits.find((split) => !split.team)?.stat ?? cardinals;
  return { cardinals, combined };
}

async function loadTeamPlayers(year: number) {
  const rosterResponse = await fetch(`https://statsapi.mlb.com/api/v1/teams/${CARDINALS_TEAM_ID}/roster?rosterType=fullSeason&season=${year}`, {
    next: {
      revalidate: 3600,
    },
  });

  if (!rosterResponse.ok) {
    return [] as TeamPlayerSeason[];
  }

  const rosterData = (await rosterResponse.json()) as RosterResponse;
  const roster = rosterData.roster ?? [];
  const environment = await getSeasonEnvironment(year);

  const reports = await Promise.all(
    roster.map(async (entry) => {
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/people/${entry.person.id}/stats?stats=season&group=hitting,pitching&season=${year}`,
        { next: { revalidate: 3600 } }
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as PlayerSeasonSplits;
      const hittingSplits = cardinalsSplits(data, "hitting");
      const pitchingSplits = cardinalsSplits(data, "pitching");
      const hitting = hittingSplits.cardinals;
      const pitching = pitchingSplits.cardinals;
      const hittingGames = hitting?.gamesPlayed ?? 0;
      const pitchingGames = pitching?.gamesPitched ?? 0;

      if (hittingGames === 0 && pitchingGames === 0) {
        return null;
      }

      const role: TeamPlayerSeason["role"] = pitchingGames > 0 && pitchingGames >= hittingGames ? "Pitcher" : "Hitter";

      // WAR and wRC+/ERA+ for his Cardinals time only, the same way the
      // player pages compute them.
      const stints = [{ teamId: CARDINALS_TEAM_ID, stat: (role === "Pitcher" ? pitching : hitting) as StatLine }];
      const war =
        role === "Pitcher"
          ? (await getPitcherWar(year, pitching as StatLine, stints))?.war ?? null
          : (
              await getPositionPlayerWar(
                entry.person.id,
                year,
                hitting as StatLine,
                stints,
                hittingSplits.combined?.plateAppearances ?? hitting?.plateAppearances ?? 0
              )
            )?.war ?? null;
      const plus = environment
        ? role === "Pitcher"
          ? computeEraPlus(pitching as StatLine, stints, environment)
          : computeWrcPlus(hitting as StatLine, stints, environment)
        : null;

      return {
        id: entry.person.id,
        name: entry.person.fullName,
        position: entry.position.abbreviation ?? (role === "Pitcher" ? "P" : ""),
        role,
        imageUrl: getPlayerHeadshotUrl(entry.person.id),
        hitting,
        pitching,
        war,
        plus,
      } satisfies TeamPlayerSeason;
    })
  );

  return reports.filter((player): player is TeamPlayerSeason => player !== null);
}

function buildHittersTab(players: TeamPlayerSeason[], teamGamesPlayed: number): LeaderboardTabData {
  const hitterQualificationPA = Math.ceil(teamGamesPlayed * 3.1);

  const hitters = players.filter((player) => player.role === "Hitter" && player.hitting);

  return {
    key: "hitters",
    categories: [
      buildLeaderboardCategory(hitters, {
        key: "war",
        label: "WAR",
        description: "All Cardinals hitters",
        sortDirection: "desc",
        qualified: false,
        pool: "hitting",
        selectValue: (player) => player.war ?? null,
        displayValue: (player) => (player.war ?? 0).toFixed(1),
        isQualified: () => true,
      }),
      buildLeaderboardCategory(hitters, {
        key: "wrcplus",
        label: "wRC+",
        description: "Qualified hitters",
        sortDirection: "desc",
        qualified: true,
        pool: "hitting",
        selectValue: (player) => player.plus ?? null,
        displayValue: (player) => String(Math.round(player.plus ?? 0)),
        isQualified: (player) => (player.hitting?.plateAppearances ?? 0) >= hitterQualificationPA,
      }),
      buildLeaderboardCategory(hitters, {
        key: "avg",
        label: "AVG",
        description: "Qualified hitters",
        sortDirection: "desc",
        qualified: true,
        pool: "hitting",
        selectValue: (player) => (player.hitting?.avg ? Number(player.hitting.avg) : null),
        displayValue: (player) => player.hitting?.avg ?? "—",
        isQualified: (player) => (player.hitting?.plateAppearances ?? 0) >= hitterQualificationPA,
      }),
      buildLeaderboardCategory(hitters, {
        key: "obp",
        label: "OBP",
        description: "Qualified hitters",
        sortDirection: "desc",
        qualified: true,
        pool: "hitting",
        selectValue: (player) => (player.hitting?.obp ? Number(player.hitting.obp) : null),
        displayValue: (player) => player.hitting?.obp ?? "—",
        isQualified: (player) => (player.hitting?.plateAppearances ?? 0) >= hitterQualificationPA,
      }),
      buildLeaderboardCategory(hitters, {
        key: "slg",
        label: "SLG",
        description: "Qualified hitters",
        sortDirection: "desc",
        qualified: true,
        pool: "hitting",
        selectValue: (player) => (player.hitting?.slg ? Number(player.hitting.slg) : null),
        displayValue: (player) => player.hitting?.slg ?? "—",
        isQualified: (player) => (player.hitting?.plateAppearances ?? 0) >= hitterQualificationPA,
      }),
      buildLeaderboardCategory(hitters, {
        key: "ops",
        label: "OPS",
        description: "Qualified hitters",
        sortDirection: "desc",
        qualified: true,
        pool: "hitting",
        selectValue: (player) => (player.hitting?.ops ? Number(player.hitting.ops) : null),
        displayValue: (player) => player.hitting?.ops ?? "—",
        isQualified: (player) => (player.hitting?.plateAppearances ?? 0) >= hitterQualificationPA,
      }),
      buildLeaderboardCategory(hitters, {
        key: "hr",
        label: "HR",
        description: "All Cardinals hitters",
        sortDirection: "desc",
        qualified: false,
        pool: "hitting",
        selectValue: (player) => player.hitting?.homeRuns ?? null,
        displayValue: (player) => formatNumber(player.hitting?.homeRuns),
        isQualified: () => true,
      }),
      buildLeaderboardCategory(hitters, {
        key: "xbh",
        label: "XBH",
        description: "All Cardinals hitters",
        sortDirection: "desc",
        qualified: false,
        pool: "hitting",
        selectValue: (player) => {
          const stat = player.hitting;
          if (!stat) {
            return null;
          }

          return (stat.doubles ?? 0) + (stat.triples ?? 0) + (stat.homeRuns ?? 0);
        },
        displayValue: (player) => {
          const stat = player.hitting;
          if (!stat) {
            return "—";
          }

          return formatNumber((stat.doubles ?? 0) + (stat.triples ?? 0) + (stat.homeRuns ?? 0));
        },
        isQualified: () => true,
      }),
      buildLeaderboardCategory(hitters, {
        key: "rbi",
        label: "RBI",
        description: "All Cardinals hitters",
        sortDirection: "desc",
        qualified: false,
        pool: "hitting",
        selectValue: (player) => player.hitting?.rbi ?? null,
        displayValue: (player) => formatNumber(player.hitting?.rbi),
        isQualified: () => true,
      }),
      buildLeaderboardCategory(hitters, {
        key: "sb",
        label: "SB",
        description: "All Cardinals hitters",
        sortDirection: "desc",
        qualified: false,
        pool: "hitting",
        selectValue: (player) => player.hitting?.stolenBases ?? null,
        displayValue: (player) => formatNumber(player.hitting?.stolenBases),
        isQualified: () => true,
      }),
      buildLeaderboardCategory(hitters, {
        key: "bbpct",
        label: "BB%",
        description: "Qualified hitters",
        sortDirection: "desc",
        qualified: true,
        pool: "hitting",
        selectValue: (player) => {
          const stat = player.hitting;
          const pa = stat?.plateAppearances ?? 0;
          if (!stat || pa === 0) {
            return null;
          }

          return ((stat.baseOnBalls ?? 0) / pa) * 100;
        },
        displayValue: (player) => {
          const stat = player.hitting;
          const pa = stat?.plateAppearances ?? 0;
          if (!stat || pa === 0) {
            return "—";
          }

          return formatPercent(((stat.baseOnBalls ?? 0) / pa) * 100);
        },
        isQualified: (player) => (player.hitting?.plateAppearances ?? 0) >= hitterQualificationPA,
      }),
      buildLeaderboardCategory(hitters, {
        key: "kpct",
        label: "K%",
        description: "Qualified hitters",
        sortDirection: "asc",
        qualified: true,
        pool: "hitting",
        selectValue: (player) => {
          const stat = player.hitting;
          const pa = stat?.plateAppearances ?? 0;
          if (!stat || pa === 0) {
            return null;
          }

          return ((stat.strikeOuts ?? 0) / pa) * 100;
        },
        displayValue: (player) => {
          const stat = player.hitting;
          const pa = stat?.plateAppearances ?? 0;
          if (!stat || pa === 0) {
            return "—";
          }

          return formatPercent(((stat.strikeOuts ?? 0) / pa) * 100);
        },
        isQualified: (player) => (player.hitting?.plateAppearances ?? 0) >= hitterQualificationPA,
      }),
    ],
  };
}

function buildPitchersTab(players: TeamPlayerSeason[], teamGamesPlayed: number): LeaderboardTabData {
  const pitcherQualificationOuts = teamGamesPlayed * 3;

  const pitchers = players.filter((player) => player.role === "Pitcher" && player.pitching);

  return {
    key: "pitchers",
    categories: [
      buildLeaderboardCategory(pitchers, {
        key: "war",
        label: "WAR",
        description: "All Cardinals pitchers",
        sortDirection: "desc",
        qualified: false,
        pool: "pitching",
        selectValue: (player) => player.war ?? null,
        displayValue: (player) => (player.war ?? 0).toFixed(1),
        isQualified: () => true,
      }),
      buildLeaderboardCategory(pitchers, {
        key: "eraplus",
        label: "ERA+",
        description: "Qualified pitchers",
        sortDirection: "desc",
        qualified: true,
        pool: "pitching",
        selectValue: (player) => player.plus ?? null,
        displayValue: (player) => String(Math.round(player.plus ?? 0)),
        isQualified: (player) => inningsToOuts(player.pitching?.inningsPitched) >= pitcherQualificationOuts,
      }),
      buildLeaderboardCategory(pitchers, {
        key: "era",
        label: "ERA",
        description: "Qualified pitchers",
        sortDirection: "asc",
        qualified: true,
        pool: "pitching",
        selectValue: (player) => (player.pitching?.era ? Number(player.pitching.era) : null),
        displayValue: (player) => player.pitching?.era ?? "—",
        isQualified: (player) => inningsToOuts(player.pitching?.inningsPitched) >= pitcherQualificationOuts,
      }),
      buildLeaderboardCategory(pitchers, {
        key: "whip",
        label: "WHIP",
        description: "Qualified pitchers",
        sortDirection: "asc",
        qualified: true,
        pool: "pitching",
        selectValue: (player) => (player.pitching?.whip ? Number(player.pitching.whip) : null),
        displayValue: (player) => player.pitching?.whip ?? "—",
        isQualified: (player) => inningsToOuts(player.pitching?.inningsPitched) >= pitcherQualificationOuts,
      }),
      buildLeaderboardCategory(pitchers, {
        key: "k",
        label: "K",
        description: "All Cardinals pitchers",
        sortDirection: "desc",
        qualified: false,
        pool: "pitching",
        selectValue: (player) => player.pitching?.strikeOuts ?? null,
        displayValue: (player) => formatNumber(player.pitching?.strikeOuts),
        isQualified: () => true,
      }),
      buildLeaderboardCategory(pitchers, {
        key: "kpct",
        label: "K%",
        description: "Qualified pitchers",
        sortDirection: "desc",
        qualified: true,
        pool: "pitching",
        selectValue: (player) => {
          const stat = player.pitching;
          const battersFaced = stat?.battersFaced ?? 0;
          if (!stat || battersFaced === 0) {
            return null;
          }

          return ((stat.strikeOuts ?? 0) / battersFaced) * 100;
        },
        displayValue: (player) => {
          const stat = player.pitching;
          const battersFaced = stat?.battersFaced ?? 0;
          if (!stat || battersFaced === 0) {
            return "—";
          }

          return formatPercent(((stat.strikeOuts ?? 0) / battersFaced) * 100);
        },
        isQualified: (player) => inningsToOuts(player.pitching?.inningsPitched) >= pitcherQualificationOuts,
      }),
      buildLeaderboardCategory(pitchers, {
        key: "bbpct",
        label: "BB%",
        description: "Qualified pitchers",
        sortDirection: "asc",
        qualified: true,
        pool: "pitching",
        selectValue: (player) => {
          const stat = player.pitching;
          const battersFaced = stat?.battersFaced ?? 0;
          if (!stat || battersFaced === 0) {
            return null;
          }

          return ((stat.baseOnBalls ?? 0) / battersFaced) * 100;
        },
        displayValue: (player) => {
          const stat = player.pitching;
          const battersFaced = stat?.battersFaced ?? 0;
          if (!stat || battersFaced === 0) {
            return "—";
          }

          return formatPercent(((stat.baseOnBalls ?? 0) / battersFaced) * 100);
        },
        isQualified: (player) => inningsToOuts(player.pitching?.inningsPitched) >= pitcherQualificationOuts,
      }),
      buildLeaderboardCategory(pitchers, {
        key: "kminusbbpct",
        label: "K - BB%",
        description: "Qualified pitchers",
        sortDirection: "desc",
        qualified: true,
        pool: "pitching",
        selectValue: (player) => {
          const stat = player.pitching;
          const battersFaced = stat?.battersFaced ?? 0;
          if (!stat || battersFaced === 0) {
            return null;
          }

          const strikeoutPercent = ((stat.strikeOuts ?? 0) / battersFaced) * 100;
          const walkPercent = ((stat.baseOnBalls ?? 0) / battersFaced) * 100;

          return strikeoutPercent - walkPercent;
        },
        displayValue: (player) => {
          const stat = player.pitching;
          const battersFaced = stat?.battersFaced ?? 0;
          if (!stat || battersFaced === 0) {
            return "—";
          }

          const strikeoutPercent = ((stat.strikeOuts ?? 0) / battersFaced) * 100;
          const walkPercent = ((stat.baseOnBalls ?? 0) / battersFaced) * 100;

          return formatPercent(strikeoutPercent - walkPercent);
        },
        isQualified: (player) => inningsToOuts(player.pitching?.inningsPitched) >= pitcherQualificationOuts,
      }),
      buildLeaderboardCategory(pitchers, {
        key: "sv",
        label: "SV",
        description: "All Cardinals pitchers",
        sortDirection: "desc",
        qualified: false,
        pool: "pitching",
        selectValue: (player) => player.pitching?.saves ?? null,
        displayValue: (player) => formatNumber(player.pitching?.saves),
        isQualified: () => true,
      }),
      buildLeaderboardCategory(pitchers, {
        key: "ip",
        label: "IP",
        description: "All Cardinals pitchers",
        sortDirection: "desc",
        qualified: false,
        pool: "pitching",
        selectValue: (player) => inningsToOuts(player.pitching?.inningsPitched),
        displayValue: (player) => player.pitching?.inningsPitched ?? "—",
        isQualified: () => true,
      }),
    ],
  };
}

async function loadStatsPageData(currentYear: number): Promise<StatsLeadersPageData> {
  // Before a new season starts (no games yet), show the last completed one.
  let year = currentYear;
  let teamGamesPlayed = await loadTeamGamesPlayed(year);
  if (teamGamesPlayed === 0) {
    year -= 1;
    teamGamesPlayed = await loadTeamGamesPlayed(year);
  }
  const teamPlayers = await loadTeamPlayers(year);

  const hitters = buildHittersTab(teamPlayers, teamGamesPlayed);
  const pitchers = buildPitchersTab(teamPlayers, teamGamesPlayed);

  return {
    year,
    totalPlayers: teamPlayers.length,
    teamGamesPlayed,
    hitterQualificationPA: Math.ceil(teamGamesPlayed * 3.1),
    pitcherQualificationOuts: teamGamesPlayed * 3,
    hitters,
    pitchers,
  };
}

export default async function StatsPage() {
  const year = new Date().getFullYear();
  const data = await loadStatsPageData(year);

  return (
    <div style={{ display: "grid", gap: "2.75rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Players · Leaders</p>
        <h1 className="section-title">Cardinals Leaderboards</h1>
        <p style={{ marginTop: "0.6rem", color: "var(--muted)" }}>
          {data.year} season · Cardinals stats only · qualified: {data.hitterQualificationPA} PA /{" "}
          {Math.floor(data.pitcherQualificationOuts / 3)} IP
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.12s" }}>
        <PlayerReportBrowser data={data} />
      </section>
    </div>
  );
}
