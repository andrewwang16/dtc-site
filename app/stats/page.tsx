import PlayerReportBrowser from "../../components/stats/PlayerReportBrowser";
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

type PeopleResponse = {
  people?: Array<{
    id: number;
    fullName: string;
    stats?: Array<{
      group?: {
        displayName?: string;
      };
      type?: {
        displayName?: string;
      };
      splits?: Array<{
        stat?: SeasonStatLine;
      }>;
    }>;
  }>;
};

type PeopleStatPerson = {
  stats?: Array<{
    group?: {
      displayName?: string;
    };
    type?: {
      displayName?: string;
    };
    splits?: Array<{
      stat?: SeasonStatLine;
    }>;
  }>;
};

const CARDINALS_TEAM_ID = 138;

const CHICAGO_ISO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toIsoDate(date: Date) {
  // Pinned to Central time so "today" matches the Cardinals' local day
  // regardless of the server's own timezone (typically UTC).
  return CHICAGO_ISO_DATE_FORMATTER.format(date);
}

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

function getSeasonStat(person: PeopleStatPerson, group: "hitting" | "pitching") {
  return person.stats?.find((entry) => entry.group?.displayName === group && entry.type?.displayName === "season")?.splits?.[0]?.stat;
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
    .slice(0, 3);

  return {
    key: options.key,
    label: options.label,
    description: options.description,
    sortDirection: options.sortDirection,
    qualified: options.qualified,
    players: rankedPlayers,
  };
}

async function loadTeamGamesPlayed(year: number, todayIso: string) {
  const response = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${CARDINALS_TEAM_ID}&startDate=${year}-01-01&endDate=${todayIso}&gameType=R`,
    {
      next: {
        revalidate: 3600,
      },
    }
  );

  if (!response.ok) {
    return 0;
  }

  const data = (await response.json()) as { dates?: Array<{ games?: Array<{ status?: { abstractGameState?: string } }> }> };

  return (data.dates ?? [])
    .flatMap((group) => group.games ?? [])
    .filter((game) => game.status?.abstractGameState !== "Preview").length;
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

  const reports = await Promise.all(
    roster.map(async (entry) => {
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/people/${entry.person.id}?hydrate=stats(group=[hitting,pitching],type=[season])`,
        {
          next: {
            revalidate: 3600,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as PeopleResponse;
      const person = data.people?.[0];

      if (!person) {
        return null;
      }

      const hitting = getSeasonStat(person, "hitting");
      const pitching = getSeasonStat(person, "pitching");
      const hittingGames = hitting?.gamesPlayed ?? 0;
      const pitchingGames = pitching?.gamesPitched ?? 0;

      if (hittingGames === 0 && pitchingGames === 0) {
        return null;
      }

      const role: TeamPlayerSeason["role"] = pitchingGames > 0 && pitchingGames >= hittingGames ? "Pitcher" : "Hitter";

      return {
        id: person.id,
        name: person.fullName,
        position: entry.position.abbreviation ?? (role === "Pitcher" ? "P" : ""),
        role,
        imageUrl: getPlayerHeadshotUrl(person.id),
        hitting,
        pitching,
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

async function loadStatsPageData(year: number): Promise<StatsLeadersPageData> {
  const todayIso = toIsoDate(new Date());
  const [teamGamesPlayed, teamPlayers] = await Promise.all([loadTeamGamesPlayed(year, todayIso), loadTeamPlayers(year)]);

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
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.12s" }}>
        <PlayerReportBrowser data={data} />
      </section>
    </div>
  );
}
