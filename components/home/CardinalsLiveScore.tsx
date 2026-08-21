import Link from "next/link";
import type { ReactNode } from "react";
import BoxScoreButton from "./BoxScoreButton";
import { getTeamNotablePositionPlayers, type NotablePlayer } from "@/lib/mlb";

type MlbPlayerRef = {
  id: number;
  fullName?: string;
};

type MlbPlayerStats = {
  avg?: string;
  ops?: string;
  homeRuns?: number;
  rbi?: number;
  era?: string;
  wins?: number;
  losses?: number;
  saves?: number;
  whip?: string;
  strikeOuts?: number;
};

type MlbTeam = {
  id: number;
  name: string;
};

type MlbGame = {
  gamePk: number;

  gameDate: string;

  gameNumber?: number;

  status: {
    abstractGameState?: string;
    detailedState?: string;
  };

  teams: {
    away: {
      score?: number;
      team: MlbTeam;
      probablePitcher?: MlbPlayerRef;
    };

    home: {
      score?: number;
      team: MlbTeam;
      probablePitcher?: MlbPlayerRef;
    };
  };

  decisions?: {
    winner?: MlbPlayerRef;
    loser?: MlbPlayerRef;
    save?: MlbPlayerRef;
  };

  venue?: {
    name?: string;
    location?: {
      city?: string;
      state?: string;
    };
  };
};

type MlbScheduleResponse = {
  dates?: Array<{
    date: string;
    games: MlbGame[];
  }>;
};

type LiveFeedResponse = {
  liveData: {
    linescore?: {
      currentInning?: number;
      inningHalf?: string;

      balls?: number;
      strikes?: number;
      outs?: number;

      offense?: {
        batter?: MlbPlayerRef;
        first?: MlbPlayerRef;
        second?: MlbPlayerRef;
        third?: MlbPlayerRef;
      };

      defense?: {
        pitcher?: MlbPlayerRef;
      };

      innings?: Array<{
        num: number;

        away?: {
          runs?: number;
        };

        home?: {
          runs?: number;
        };
      }>;
    };

    boxscore?: {
      teams: {
        away: {
          players: Record<string, any>;

          teamStats?: {
            batting?: {
              hits?: number;
            };

            fielding?: {
              errors?: number;
            };
          };
        };

        home: {
          players: Record<string, any>;

          teamStats?: {
            batting?: {
              hits?: number;
            };

            fielding?: {
              errors?: number;
            };
          };
        };
      };
    };
  };
};

const CARDINALS_TEAM_ID = 138;

const CHICAGO_ISO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toIsoDate(date: Date) {
  // "en-CA" formats as YYYY-MM-DD. The server can run in any timezone
  // (typically UTC), so this must be pinned to Central time explicitly —
  // otherwise "today" flips to the wrong calendar day during evening
  // games, when it's already tomorrow in UTC but still today in Chicago.
  return CHICAGO_ISO_DATE_FORMATTER.format(date);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);

  result.setDate(result.getDate() + days);

  return result;
}

function teamLogoUrl(teamId: number) {
  return `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`;
}

function playerHeadshotUrl(
  playerId: number,
  width = 120
) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${width},q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

function gameTimeLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(new Date(date));
}

function gameDateTimeLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(new Date(date));
}

async function getPlayerStats(
  playerId: number,
  group: "hitting" | "pitching"
): Promise<MlbPlayerStats | null> {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${playerId}` +
        `?hydrate=stats(group=[${group}],type=[season])`,
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return (
      data.people?.[0]
        ?.stats?.[0]
        ?.splits?.[0]
        ?.stat ?? null
    );
  } catch {
    return null;
  }
}

async function getLiveFeed(
  gamePk: number
): Promise<LiveFeedResponse | null> {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
      {
        next: {
          revalidate: 30,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function selectScoreboardGame(
  dates: Array<{ date: string; games: MlbGame[] }>,
  todayIso: string
): {
  selectedGame: MlbGame | null;
  doubleheaderGames: MlbGame[] | null;
} {
  const todayGroup = dates.find(
    (group) => group.date === todayIso
  );

  const todayGames = (todayGroup?.games ?? [])
    .slice()
    .sort(
      (a, b) =>
        (a.gameNumber ?? 1) - (b.gameNumber ?? 1)
    );

  const doubleheaderGames =
    todayGames.length >= 2 ? todayGames : null;

  /*
   * A LIVE GAME TODAY ALWAYS WINS
   */

  const liveToday = todayGames.find(
    (game) =>
      game.status.abstractGameState === "Live"
  );

  if (liveToday) {
    return { selectedGame: liveToday, doubleheaderGames };
  }

  /*
   * DOUBLEHEADER: DEFER TO GAME 2 ONCE GAME 1 IS FINAL
   */

  if (
    todayGames.length >= 2 &&
    todayGames[0].status.abstractGameState === "Final"
  ) {
    return {
      selectedGame: todayGames[1],
      doubleheaderGames,
    };
  }

  /*
   * A COMPLETED GAME FROM TODAY BEATS A FUTURE PREVIEW
   */

  const finalToday = todayGames.find(
    (game) =>
      game.status.abstractGameState === "Final"
  );

  if (finalToday) {
    return { selectedGame: finalToday, doubleheaderGames };
  }

  /*
   * NOTHING HAS HAPPENED TODAY YET — PREVIEW THE NEXT GAME
   */

  const now = Date.now();

  const upcoming = dates
    .flatMap((group) => group.games)
    .filter(
      (game) =>
        game.status.abstractGameState ===
          "Preview" &&
        new Date(game.gameDate).getTime() >= now
    )
    .sort(
      (a, b) =>
        new Date(a.gameDate).getTime() -
        new Date(b.gameDate).getTime()
    );

  return {
    selectedGame: upcoming[0] ?? null,
    doubleheaderGames,
  };
}

async function findMostRecentFinalGame(
  today: Date
): Promise<MlbGame | null> {
  const currentYear = Number(toIsoDate(today).slice(0, 4));

  for (const year of [currentYear, currentYear - 1]) {
    try {
      const response = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule` +
          `?sportId=1` +
          `&teamId=${CARDINALS_TEAM_ID}` +
          `&startDate=${year}-01-01` +
          `&endDate=${year}-12-31` +
          `&hydrate=team,probablePitcher,venue(location),decisions`,
        {
          next: {
            revalidate: 3600,
          },
        }
      );

      if (response.ok) {
        const data: MlbScheduleResponse =
          await response.json();

        const finals = (data.dates ?? [])
          .flatMap((group) => group.games)
          .filter(
            (game) =>
              game.status.abstractGameState ===
              "Final"
          )
          .sort(
            (a, b) =>
              new Date(b.gameDate).getTime() -
              new Date(a.gameDate).getTime()
          );

        if (finals[0]) {
          return finals[0];
        }
      }
    } catch {
      // fall through and try the previous year
    }
  }

  return null;
}

function BasesIcon({
  first,
  second,
  third,
}: {
  first: boolean;
  second: boolean;
  third: boolean;
}) {
  const baseStyle = (active: boolean) => ({
    width: "14px",
    height: "14px",
    transform: "rotate(45deg)",
    border: "1px solid rgba(15,31,61,.3)",
    background: active
      ? "var(--accent)"
      : "rgba(15,31,61,.12)",
    position: "absolute" as const,
  });

  return (
    <div
      style={{
        position: "relative",
        width: "50px",
        height: "50px",
      }}
    >
      <div
        style={{
          ...baseStyle(second),
          top: "0",
          left: "18px",
        }}
      />

      <div
        style={{
          ...baseStyle(third),
          top: "18px",
          left: "0",
        }}
      />

      <div
        style={{
          ...baseStyle(first),
          top: "18px",
          right: "0",
        }}
      />
    </div>
  );
}

function findTopHitter(
  players: Record<string, any>
) {
  const hitters = Object.values(players).filter(
    (player: any) => player.stats?.batting
  );

  if (!hitters.length) {
    return null;
  }

  hitters.sort((a: any, b: any) => {
    const aHits =
      a.stats?.batting?.hits ?? 0;

    const bHits =
      b.stats?.batting?.hits ?? 0;

    return bHits - aHits;
  });

  return hitters[0];
}

/*
 * Fantasy points are only used to rank "Top Performers" — the point value
 * itself is never displayed, just the resulting ranking.
 */
function computeFantasyPoints(player: any): number {
  let points = 0;

  const batting = player.stats?.batting;

  if (batting) {
    const hits = batting.hits ?? 0;
    const doubles = batting.doubles ?? 0;
    const triples = batting.triples ?? 0;
    const homeRuns = batting.homeRuns ?? 0;
    const singles = Math.max(0, hits - doubles - triples - homeRuns);

    points +=
      singles * 3 +
      doubles * 5 +
      triples * 8 +
      homeRuns * 10 +
      (batting.rbi ?? 0) * 2 +
      (batting.runs ?? 0) * 2 +
      (batting.baseOnBalls ?? 0) * 2 +
      (batting.hitByPitch ?? 0) * 2 +
      (batting.stolenBases ?? 0) * 5;
  }

  const pitching = player.stats?.pitching;

  if (pitching) {
    const outs = pitching.outs ?? 0;

    points +=
      outs * 1 +
      (pitching.strikeOuts ?? 0) * 2 +
      (pitching.wins ?? 0) * 4 +
      (pitching.saves ?? 0) * 4 -
      (pitching.earnedRuns ?? 0) * 2 -
      (pitching.hits ?? 0) * 0.6 -
      (pitching.baseOnBalls ?? 0) * 0.6 -
      (pitching.hitBatsmen ?? 0) * 0.6;
  }

  return points;
}

type TopPerformer = {
  id: number;
  fullName: string;
  summary: string;
};

function getTopPerformers(
  feed: LiveFeedResponse | null,
  limit = 3
): TopPerformer[] {
  const boxscore = feed?.liveData?.boxscore;

  if (!boxscore) {
    return [];
  }

  const allPlayers = [
    ...Object.values(boxscore.teams.away.players ?? {}),
    ...Object.values(boxscore.teams.home.players ?? {}),
  ];

  const scored = allPlayers
    .map((player: any) => ({
      id: Number(player.person?.id),
      fullName: player.person?.fullName as string | undefined,
      summary: (player.stats?.batting?.summary ??
        player.stats?.pitching?.summary) as string | undefined,
      points: computeFantasyPoints(player),
    }))
    .filter(
      (player): player is TopPerformer & { points: number } =>
        Boolean(player.id) && Boolean(player.fullName) && Boolean(player.summary)
    );

  scored.sort((a, b) => b.points - a.points);

  return scored.slice(0, limit).map(({ id, fullName, summary }) => ({
    id,
    fullName,
    summary,
  }));
}

function playerFromBoxscore(
  player: any
): MlbPlayerRef | null {
  if (!player) {
    return null;
  }

  return {
    id: Number(player.person?.id),
    fullName: player.person?.fullName,
  };
}

function PlayerLink({
  playerId,
  children,
}: {
  playerId?: number;
  children: ReactNode;
}) {
  if (!playerId) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <Link
      href={`/players/${playerId}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function NotablePlayersList({
  teamName,
  players,
}: {
  teamName: string;
  players: NotablePlayer[];
}) {
  if (players.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="kicker" style={{ marginBottom: "0.6rem", color: "inherit" }}>
        {teamName} Notable Hitters
      </p>

      <div style={{ display: "grid", gap: "0.6rem" }}>
        {players.map((player) => (
          <Link
            key={player.id}
            href={`/players/${player.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "50px",
                borderRadius: "8px",
                overflow: "hidden",
                flexShrink: 0,
                background: "rgba(15,31,61,.08)",
                border: "1px solid var(--line)",
              }}
            >
              <img
                src={playerHeadshotUrl(player.id, 80)}
                alt={player.fullName}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                }}
              />
            </div>

            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.92rem" }}>
                {player.fullName}
              </p>
              <p style={{ margin: 0, color: "rgba(15,31,61,.65)", fontSize: "0.8rem" }}>
                {player.position} · AVG {player.avg} · HR {player.homeRuns} · RBI{" "}
                {player.rbi} · OPS {player.ops}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function CardinalsLiveScore() {
  const today = new Date();

  const todayIso = toIsoDate(today);

  const yesterday = addDays(today, -1);

  const lookahead = addDays(today, 10);

  const startDate = toIsoDate(yesterday);

  const endDate = toIsoDate(lookahead);

  let selectedGame: MlbGame | null = null;

  let doubleheaderGames: MlbGame[] | null = null;

  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule` +
        `?sportId=1` +
        `&teamId=${CARDINALS_TEAM_ID}` +
        `&startDate=${startDate}` +
        `&endDate=${endDate}` +
        `&hydrate=team,probablePitcher,venue(location),decisions`,
      {
        next: {
          revalidate: 60,
        },
      }
    );

    if (response.ok) {
      const data: MlbScheduleResponse =
        await response.json();

      const dates = data.dates ?? [];

      const result = selectScoreboardGame(
        dates,
        todayIso
      );

      selectedGame = result.selectedGame;

      doubleheaderGames = result.doubleheaderGames;
    }

    if (!selectedGame) {
      selectedGame = await findMostRecentFinalGame(
        today
      );
    }
  } catch {
    selectedGame = null;
  }

  if (!selectedGame) {
    return (
      <section>
        <article
          style={{
            padding: "1rem",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "18px",
          }}
        >
          <p className="kicker">
            Cardinals Scoreboard
          </p>

          <h2>No game available</h2>
        </article>
      </section>
    );
  }

  const feed = await getLiveFeed(
    selectedGame.gamePk
  );

  const linescore =
    feed?.liveData?.linescore;

  const isLive =
    selectedGame.status.abstractGameState ===
    "Live";

  const isFinal =
    selectedGame.status.abstractGameState ===
    "Final";

  const isPreview = !isLive && !isFinal;

  const topPerformers = isPreview ? [] : getTopPerformers(feed);

  /*
   * AWAY AND HOME TEAMS
   */

  const home = selectedGame.teams.home;

  const away = selectedGame.teams.away;

  const cardinalsAreHome =
    home.team.id === CARDINALS_TEAM_ID;

  const cardinals = cardinalsAreHome
    ? home
    : away;

  /*
   * NOTABLE POSITION PLAYERS
   */

  const currentSeasonYear = Number(todayIso.slice(0, 4));

  const [awayNotablePlayers, homeNotablePlayers] = await Promise.all([
    getTeamNotablePositionPlayers(away.team.id, currentSeasonYear),
    getTeamNotablePositionPlayers(home.team.id, currentSeasonYear),
  ]);

  /*
   * LIVE PLAYER DATA
   */

  let pitcher =
    linescore?.defense?.pitcher;

  let hitter =
    linescore?.offense?.batter;

  /*
   * SCHEDULED PITCHER FALLBACK
   */

  if (!pitcher) {
    pitcher =
      cardinals.probablePitcher;
  }

  /*
   * FINAL GAME FALLBACKS
   */

  let topHitter: any = null;

  if (
    isFinal &&
    feed?.liveData?.boxscore
  ) {
    const teamBox = cardinalsAreHome
      ? feed.liveData.boxscore.teams.home
          .players
      : feed.liveData.boxscore.teams.away
          .players;

    topHitter = findTopHitter(teamBox);

    if (!hitter && topHitter) {
      hitter =
        playerFromBoxscore(
          topHitter
        ) ?? undefined;
    }
  }

  /*
   * PLAYER STATS
   */

  const pitcherStats = pitcher
    ? await getPlayerStats(
        pitcher.id,
        "pitching"
      )
    : null;

  const hitterStats = hitter
    ? await getPlayerStats(
        hitter.id,
        "hitting"
      )
    : null;

  /*
   * PROBABLE STARTERS (PREVIEW ONLY)
   */

  const awayProbablePitcher =
    away.probablePitcher;

  const homeProbablePitcher =
    home.probablePitcher;

  const awayProbablePitcherStats =
    isPreview && awayProbablePitcher
      ? await getPlayerStats(
          awayProbablePitcher.id,
          "pitching"
        )
      : null;

  const homeProbablePitcherStats =
    isPreview && homeProbablePitcher
      ? await getPlayerStats(
          homeProbablePitcher.id,
          "pitching"
        )
      : null;

  /*
   * DECISION PITCHER RECORDS (FINAL ONLY)
   */

  const winnerStats =
    isFinal && selectedGame.decisions?.winner?.id
      ? await getPlayerStats(
          selectedGame.decisions.winner.id,
          "pitching"
        )
      : null;

  const loserStats =
    isFinal && selectedGame.decisions?.loser?.id
      ? await getPlayerStats(
          selectedGame.decisions.loser.id,
          "pitching"
        )
      : null;

  const saveStats =
    isFinal && selectedGame.decisions?.save?.id
      ? await getPlayerStats(
          selectedGame.decisions.save.id,
          "pitching"
        )
      : null;

  /*
   * LINESCORE DATA
   */

  const innings =
    linescore?.innings ?? [];

  const bases =
    linescore?.offense;

  /*
   * TEAM HITS AND ERRORS
   */

  const awayTeamStats =
    feed?.liveData?.boxscore?.teams
      ?.away?.teamStats;

  const homeTeamStats =
    feed?.liveData?.boxscore?.teams
      ?.home?.teamStats;

  const awayHits =
    awayTeamStats?.batting?.hits ?? 0;

  const homeHits =
    homeTeamStats?.batting?.hits ?? 0;

  const awayErrors =
    awayTeamStats?.fielding?.errors ?? 0;

  const homeErrors =
    homeTeamStats?.fielding?.errors ?? 0;

  return (
    <section
      className="fade-up"
      style={{
        animationDelay: "0.05s",
      }}
    >
      <article
        style={{
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "linear-gradient(155deg, #c8253f 0%, #7d0f1f 100%)",
          color: "#fdfaf3",
          padding: "1.2rem",
          display: "grid",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="kicker" style={{ marginBottom: "0.35rem", color: "inherit" }}>
              Cardinals Scoreboard
            </p>

            <p
              style={{
                margin: 0,
                color: "rgba(253,250,243,0.72)",
                fontSize: "0.9rem",
              }}
            >
              {gameDateTimeLabel(selectedGame.gameDate)}
            </p>
          </div>

          <BoxScoreButton game={selectedGame} />
        </div>

        {/* DOUBLEHEADER */}

        {doubleheaderGames && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
              fontSize: "0.85rem",
              color: "rgba(15,31,61,.75)",
              background: "rgba(15,31,61,.06)",
              borderRadius: "10px",
              padding: "0.5rem 0.75rem",
            }}
          >
            <span style={{ fontWeight: 800 }}>
              Doubleheader
            </span>

            {doubleheaderGames.map((game, index) => {
              const isFinalGame =
                game.status.abstractGameState ===
                "Final";

              const isLiveGame =
                game.status.abstractGameState ===
                "Live";

              const summary = isFinalGame
                ? `${game.teams.away.score ?? 0}-${game.teams.home.score ?? 0} Final`
                : isLiveGame
                  ? "Live"
                  : gameTimeLabel(game.gameDate);

              return (
                <span
                  key={game.gamePk}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  Game {index + 1}: {summary}

                  <BoxScoreButton game={game} />
                </span>
              );
            })}
          </div>
        )}

        {/* LINESCORE */}

        {innings.length > 0 && (
          <div
            style={{
              borderTop:
                "1px solid rgba(15,31,61,.15)",
              paddingTop: "1rem",
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                minWidth: "620px",
                tableLayout:
                  "auto",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding:
                        "0.45rem 0.35rem",
                    }}
                  >
                    Team
                  </th>

                  {innings.map(
                    (inning) => (
                      <th
                        key={inning.num}
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "0.45rem 0.35rem",
                          minWidth:
                            "32px",
                        }}
                      >
                        {inning.num}
                      </th>
                    )
                  )}

                  {/* R */}

                  <th
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "0.45rem 0.35rem",
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    R
                  </th>

                  {/* H */}

                  <th
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "0.45rem 0.35rem",
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    H
                  </th>

                  {/* E */}

                  <th
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "0.45rem 0.35rem",
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    E
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* AWAY TEAM */}

                <tr>
                  <td
                    style={{
                      padding:
                        "0.45rem 0.35rem",
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".4rem",
                      }}
                    >
                      <img
                        src={teamLogoUrl(
                          away.team.id
                        )}
                        width={20}
                        height={20}
                        alt=""
                      />
                      {away.team.name}
                    </div>
                  </td>

                  {innings.map(
                    (inning) => (
                      <td
                        key={`away-${inning.num}`}
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "0.45rem 0.35rem",
                        }}
                      >
                        {inning.away
                          ?.runs ??
                          "-"}
                      </td>
                    )
                  )}

                  {/* AWAY R */}

                  <td
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "0.45rem 0.35rem",
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    <strong>
                      {away.score ?? 0}
                    </strong>
                  </td>

                  {/* AWAY H */}

                  <td
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "0.45rem 0.35rem",
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    {awayHits}
                  </td>

                  {/* AWAY E */}

                  <td
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "0.45rem 0.35rem",
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    {awayErrors}
                  </td>
                </tr>

                {/* HOME TEAM */}

                <tr>
                  <td
                    style={{
                      padding:
                        "0.45rem 0.35rem",
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".4rem",
                      }}
                    >
                      <img
                        src={teamLogoUrl(
                          home.team.id
                        )}
                        width={20}
                        height={20}
                        alt=""
                      />
                      {home.team.name}
                    </div>
                  </td>

                  {innings.map(
                    (inning) => (
                      <td
                        key={`home-${inning.num}`}
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "0.45rem 0.35rem",
                        }}
                      >
                        {inning.home
                          ?.runs ??
                          "-"}
                      </td>
                    )
                  )}

                  {/* HOME R */}

                  <td
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "0.45rem 0.35rem",
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    <strong>
                      {home.score ?? 0}
                    </strong>
                  </td>

                  {/* HOME H */}

                  <td
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "0.45rem 0.35rem",
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    {homeHits}
                  </td>

                  {/* HOME E */}

                  <td
                    style={{
                      textAlign:
                        "center",
                      padding:
                        "0.45rem 0.35rem",
                      width: "42px",
                      minWidth: "42px",
                    }}
                  >
                    {homeErrors}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* GAME STATE */}

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            borderTop:
              "1px solid rgba(15,31,61,.15)",
            paddingTop: "1rem",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontWeight: 700,
              }}
            >
              {
                selectedGame.status
                  .detailedState
              }
            </p>

            {isLive && (
              <p
                style={{
                  margin: 0,
                  color: "rgba(253,250,243,0.72)",
                }}
              >
                {linescore?.balls ?? 0}-
                {linescore?.strikes ?? 0}
                {" "}
                {linescore?.outs ?? 0}{" "}
                out
              </p>
            )}
          </div>

          <BasesIcon
            first={Boolean(
              bases?.first
            )}
            second={Boolean(
              bases?.second
            )}
            third={Boolean(
              bases?.third
            )}
          />
        </div>

        {/* PLAYER INFORMATION */}

        {isPreview ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(280px,1fr))",
              gap: "0.5rem",
            }}
          >
            {/* AWAY PROBABLE STARTER */}

            <div
              style={{
                border:
                  "1px solid var(--line)",
                borderRadius: "14px",
                padding: "1rem",
                overflow: "hidden",
              }}
            >
              <p
                className="kicker"
                style={{
                  marginBottom: ".75rem",
                  color: "inherit",
                }}
              >
                {away.team.name} Starter
              </p>

              <PlayerLink playerId={awayProbablePitcher?.id}>
                {awayProbablePitcher?.id ? (
                  <div
                    style={{
                      width: "84px",
                      height: "104px",
                      borderRadius:
                        "16px",
                      overflow: "hidden",
                      flexShrink: 0,
                      background:
                        "rgba(15,31,61,.08)",
                      border:
                        "1px solid var(--line)",
                    }}
                  >
                    <img
                      src={playerHeadshotUrl(
                        awayProbablePitcher.id,
                        160
                      )}
                      alt={
                        awayProbablePitcher.fullName ??
                        "Probable starter"
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition:
                          "center",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: "84px",
                      height: "104px",
                      borderRadius:
                        "16px",
                      flexShrink: 0,
                      background:
                        "rgba(15,31,61,.08)",
                      border:
                        "1px solid var(--line)",
                    }}
                  />
                )}

                <div>
                  <h3
                    style={{
                      margin:
                        "0 0 .35rem",
                    }}
                  >
                    {awayProbablePitcher?.fullName ??
                      "TBD"}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "rgba(253,250,243,0.72)",
                      lineHeight: 1.6,
                    }}
                  >
                    ERA:{" "}
                    {awayProbablePitcherStats?.era ??
                      "-"}{", "}
                    W-L:{" "}
                    {awayProbablePitcherStats
                      ? `${awayProbablePitcherStats.wins ?? 0}-${awayProbablePitcherStats.losses ?? 0}`
                      : "-"}{", "}
                    WHIP:{" "}
                    {awayProbablePitcherStats?.whip ??
                      "-"}{", "}
                    K:{" "}
                    {awayProbablePitcherStats?.strikeOuts ??
                      "-"}
                  </p>
                </div>
              </PlayerLink>
            </div>

            {/* HOME PROBABLE STARTER */}

            <div
              style={{
                border:
                  "1px solid var(--line)",
                borderRadius: "14px",
                padding: "1rem",
                overflow: "hidden",
              }}
            >
              <p
                className="kicker"
                style={{
                  marginBottom: ".75rem",
                  color: "inherit",
                }}
              >
                {home.team.name} Starter
              </p>

              <PlayerLink playerId={homeProbablePitcher?.id}>
                {homeProbablePitcher?.id ? (
                  <div
                    style={{
                      width: "84px",
                      height: "104px",
                      borderRadius:
                        "16px",
                      overflow: "hidden",
                      flexShrink: 0,
                      background:
                        "rgba(15,31,61,.08)",
                      border:
                        "1px solid var(--line)",
                    }}
                  >
                    <img
                      src={playerHeadshotUrl(
                        homeProbablePitcher.id,
                        160
                      )}
                      alt={
                        homeProbablePitcher.fullName ??
                        "Probable starter"
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition:
                          "center",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: "84px",
                      height: "104px",
                      borderRadius:
                        "16px",
                      flexShrink: 0,
                      background:
                        "rgba(15,31,61,.08)",
                      border:
                        "1px solid var(--line)",
                    }}
                  />
                )}

                <div>
                  <h3
                    style={{
                      margin:
                        "0 0 .35rem",
                    }}
                  >
                    {homeProbablePitcher?.fullName ??
                      "TBD"}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "rgba(253,250,243,0.72)",
                      lineHeight: 1.6,
                    }}
                  >
                    ERA:{" "}
                    {homeProbablePitcherStats?.era ??
                      "-"}{", "}
                    W-L:{" "}
                    {homeProbablePitcherStats
                      ? `${homeProbablePitcherStats.wins ?? 0}-${homeProbablePitcherStats.losses ?? 0}`
                      : "-"}{", "}
                    WHIP:{" "}
                    {homeProbablePitcherStats?.whip ??
                      "-"}{", "}
                    K:{" "}
                    {homeProbablePitcherStats?.strikeOuts ??
                      "-"}
                  </p>
                </div>
              </PlayerLink>
            </div>
          </div>
        ) : isFinal ? (
          selectedGame.decisions ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(200px,1fr))",
                gap: "0.5rem",
              }}
            >
              {/* WINNING PITCHER */}

              <div
                style={{
                  border:
                    "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "1rem",
                  overflow: "hidden",
                }}
              >
                <p
                  className="kicker"
                  style={{
                    marginBottom: ".75rem",
                    color: "inherit",
                  }}
                >
                  Winning Pitcher
                </p>

                <PlayerLink playerId={selectedGame.decisions.winner?.id}>
                  {selectedGame.decisions.winner?.id ? (
                    <div
                      style={{
                        width: "84px",
                        height: "104px",
                        borderRadius:
                          "16px",
                        overflow: "hidden",
                        flexShrink: 0,
                        background:
                          "rgba(15,31,61,.08)",
                        border:
                          "1px solid var(--line)",
                      }}
                    >
                      <img
                        src={playerHeadshotUrl(
                          selectedGame.decisions.winner.id,
                          160
                        )}
                        alt={
                          selectedGame.decisions.winner.fullName ??
                          "Winning pitcher"
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition:
                            "center",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: "84px",
                        height: "104px",
                        borderRadius:
                          "16px",
                        flexShrink: 0,
                        background:
                          "rgba(15,31,61,.08)",
                        border:
                          "1px solid var(--line)",
                      }}
                    />
                  )}

                  <div>
                    <h3
                      style={{
                        margin: 0,
                      }}
                    >
                      {selectedGame.decisions.winner?.fullName ??
                        "-"}
                    </h3>

                    {winnerStats && (
                      <p
                        style={{
                          margin: ".2rem 0 0",
                          color: "rgba(253,250,243,0.72)",
                        }}
                      >
                        ({winnerStats.wins ?? 0}-{winnerStats.losses ?? 0})
                      </p>
                    )}
                  </div>
                </PlayerLink>
              </div>

              {/* LOSING PITCHER */}

              <div
                style={{
                  border:
                    "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "1rem",
                  overflow: "hidden",
                }}
              >
                <p
                  className="kicker"
                  style={{
                    marginBottom: ".75rem",
                    color: "inherit",
                  }}
                >
                  Losing Pitcher
                </p>

                <PlayerLink playerId={selectedGame.decisions.loser?.id}>
                  {selectedGame.decisions.loser?.id ? (
                    <div
                      style={{
                        width: "84px",
                        height: "104px",
                        borderRadius:
                          "16px",
                        overflow: "hidden",
                        flexShrink: 0,
                        background:
                          "rgba(15,31,61,.08)",
                        border:
                          "1px solid var(--line)",
                      }}
                    >
                      <img
                        src={playerHeadshotUrl(
                          selectedGame.decisions.loser.id,
                          160
                        )}
                        alt={
                          selectedGame.decisions.loser.fullName ??
                          "Losing pitcher"
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition:
                            "center",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: "84px",
                        height: "104px",
                        borderRadius:
                          "16px",
                        flexShrink: 0,
                        background:
                          "rgba(15,31,61,.08)",
                        border:
                          "1px solid var(--line)",
                      }}
                    />
                  )}

                  <div>
                    <h3
                      style={{
                        margin: 0,
                      }}
                    >
                      {selectedGame.decisions.loser?.fullName ??
                        "-"}
                    </h3>

                    {loserStats && (
                      <p
                        style={{
                          margin: ".2rem 0 0",
                          color: "rgba(253,250,243,0.72)",
                        }}
                      >
                        ({loserStats.wins ?? 0}-{loserStats.losses ?? 0})
                      </p>
                    )}
                  </div>
                </PlayerLink>
              </div>

              {/* SAVE PITCHER */}

              {selectedGame.decisions.save && (
                <div
                  style={{
                    border:
                      "1px solid var(--line)",
                    borderRadius: "14px",
                    padding: "1rem",
                    overflow: "hidden",
                  }}
                >
                  <p
                    className="kicker"
                    style={{
                      marginBottom: ".75rem",
                      color: "inherit",
                    }}
                  >
                    Save
                  </p>

                  <PlayerLink playerId={selectedGame.decisions.save.id}>
                    {selectedGame.decisions.save.id ? (
                      <div
                        style={{
                          width: "84px",
                          height: "104px",
                          borderRadius:
                            "16px",
                          overflow: "hidden",
                          flexShrink: 0,
                          background:
                            "rgba(15,31,61,.08)",
                          border:
                            "1px solid var(--line)",
                        }}
                      >
                        <img
                          src={playerHeadshotUrl(
                            selectedGame.decisions.save.id,
                            160
                          )}
                          alt={
                            selectedGame.decisions.save.fullName ??
                            "Save"
                          }
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition:
                              "center",
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "84px",
                          height: "104px",
                          borderRadius:
                            "16px",
                          flexShrink: 0,
                          background:
                            "rgba(15,31,61,.08)",
                          border:
                            "1px solid var(--line)",
                        }}
                      />
                    )}

                    <div>
                      <h3
                        style={{
                          margin: 0,
                        }}
                      >
                        {selectedGame.decisions.save.fullName ??
                          "-"}
                      </h3>

                      {saveStats && (
                        <p
                          style={{
                            margin: ".2rem 0 0",
                            color: "rgba(253,250,243,0.72)",
                          }}
                        >
                          {saveStats.saves ?? 0} SV
                        </p>
                      )}
                    </div>
                  </PlayerLink>
                </div>
              )}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                color: "rgba(253,250,243,0.72)",
              }}
            >
              Decision details unavailable.
            </p>
          )
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(280px,1fr))",
              gap: "0.5rem",
            }}
          >
            {/* HITTER */}

            <div
              style={{
                border:
                  "1px solid var(--line)",
                borderRadius: "14px",
                padding: "1rem",
                overflow: "hidden",
              }}
            >
              <p
                className="kicker"
                style={{
                  marginBottom: ".75rem",
                  color: "inherit",
                }}
              >
                AT BAT
              </p>

              <PlayerLink playerId={hitter?.id}>
                {hitter?.id ? (
                  <div
                    style={{
                      width: "84px",
                      height: "104px",
                      borderRadius:
                        "16px",
                      overflow: "hidden",
                      flexShrink: 0,
                      background:
                        "rgba(15,31,61,.08)",
                      border:
                        "1px solid var(--line)",
                    }}
                  >
                    <img
                      src={playerHeadshotUrl(
                        hitter.id,
                        160
                      )}
                      alt={
                        hitter.fullName ??
                        "Batter"
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition:
                          "center",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: "84px",
                      height: "104px",
                      borderRadius:
                        "16px",
                      flexShrink: 0,
                      background:
                        "rgba(15,31,61,.08)",
                      border:
                        "1px solid var(--line)",
                    }}
                  />
                )}

                <div>
                  <h3
                    style={{
                      margin:
                        "0 0 .35rem",
                    }}
                  >
                    {hitter?.fullName ??
                      "No batter"}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "rgba(253,250,243,0.72)",
                      lineHeight: 1.6,
                    }}
                  >
                    AVG:{" "}
                    {hitterStats?.avg ??
                      "-"}{", "}
                    HR:{" "}
                    {hitterStats?.homeRuns ??
                      "-"}{", "}
                    &nbsp;
                    RBI:{" "}
                    {hitterStats?.rbi ??
                      "-"}{", "}
                    OPS:{" "}
                    {hitterStats?.ops ??
                      "-"}
                  </p>
                </div>
              </PlayerLink>
            </div>

            {/* PITCHER */}

            <div
              style={{
                border:
                  "1px solid var(--line)",
                borderRadius: "14px",
                padding: "1rem",
                overflow: "hidden",
              }}
            >
              <p
                className="kicker"
                style={{
                  marginBottom: ".75rem",
                  color: "inherit",
                }}
              >
                PITCHING
              </p>

              <PlayerLink playerId={pitcher?.id}>
                {pitcher?.id ? (
                  <div
                    style={{
                      width: "84px",
                      height: "104px",
                      borderRadius:
                        "16px",
                      overflow: "hidden",
                      flexShrink: 0,
                      background:
                        "rgba(15,31,61,.08)",
                      border:
                        "1px solid var(--line)",
                    }}
                  >
                    <img
                      src={playerHeadshotUrl(
                        pitcher.id,
                        160
                      )}
                      alt={
                        pitcher.fullName ??
                        "Pitcher"
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition:
                          "center",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: "84px",
                      height: "104px",
                      borderRadius:
                        "16px",
                      flexShrink: 0,
                      background:
                        "rgba(15,31,61,.08)",
                      border:
                        "1px solid var(--line)",
                    }}
                  />
                )}

                <div>
                  <h3
                    style={{
                      margin:
                        "0 0 .35rem",
                    }}
                  >
                    {pitcher?.fullName ??
                      "No pitcher"}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "rgba(253,250,243,0.72)",
                      lineHeight: 1.6,
                    }}
                  >
                    ERA:{" "}
                    {pitcherStats?.era ??
                      "-"}{", "}
                    W-L:{" "}
                    {pitcherStats
                      ? `${pitcherStats.wins ?? 0}-${pitcherStats.losses ?? 0}`
                      : "-"}{", "}
                    WHIP:{" "}
                    {pitcherStats?.whip ??
                      "-"}{", "}
                    K:{" "}
                    {pitcherStats?.strikeOuts ??
                      "-"}
                  </p>
                </div>
              </PlayerLink>
            </div>
          </div>
        )}

        {/* TOP PERFORMERS */}

        {topPerformers.length > 0 && (
          <div
            style={{
              borderTop: "1px solid rgba(15,31,61,.15)",
              paddingTop: "1rem",
            }}
          >
            <p className="kicker" style={{ marginBottom: "0.6rem", color: "inherit" }}>
              Top Performers
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                gap: "0.5rem",
              }}
            >
              {topPerformers.map((performer) => (
                <div
                  key={performer.id}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "14px",
                    padding: "1rem",
                    overflow: "hidden",
                  }}
                >
                  <PlayerLink playerId={performer.id}>
                  <div
                    style={{
                      width: "84px",
                      height: "104px",
                      borderRadius: "16px",
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "rgba(15,31,61,.08)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <img
                      src={playerHeadshotUrl(performer.id, 160)}
                      alt={performer.fullName}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center",
                      }}
                    />
                  </div>

                  <div>
                    <h3 style={{ margin: 0 }}>{performer.fullName}</h3>

                    <p
                      style={{
                        margin: ".2rem 0 0",
                        color: "rgba(253,250,243,0.72)",
                      }}
                    >
                      {performer.summary}
                    </p>
                  </div>
                </PlayerLink>
              </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTABLE PLAYERS */}

        {isPreview && (awayNotablePlayers.length > 0 || homeNotablePlayers.length > 0) && (
          <div
            style={{
              borderTop: "1px solid rgba(15,31,61,.15)",
              paddingTop: "1rem",
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <NotablePlayersList teamName={away.team.name} players={awayNotablePlayers} />
            <NotablePlayersList teamName={home.team.name} players={homeNotablePlayers} />
          </div>
        )}
      </article>
    </section>
  );
}