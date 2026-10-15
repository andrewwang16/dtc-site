import { unstable_cache } from "next/cache";
import type { StatLine } from "@/lib/mlb";

// Park- and league-adjusted wRC+ (hitters) and ERA+ (pitchers) for a
// season line, built the way FanGraphs builds wRC+ / ERA-:
//
//   wOBA  = (wBB·uBB + wHBP·HBP + w1B·1B + w2B·2B + w3B·3B + wHR·HR)
//           / (AB + BB − IBB + SF + HBP)
//   wRC+  = 100 · ((wRAA/PA + lgR/PA) + (lgR/PA − PF·lgR/PA)) / league wRC/PA
//   ERA+  = 100 · league ERA / (ERA · (2 − PF))
//
// "League" is the player's own league (AL or NL), with pitchers' hitting
// left out of the league batting baseline. ERA+ uses FanGraphs' ERA-
// park adjustment, inverted onto the familiar higher-is-better scale.
//
// Park factors are computed here rather than copied: runs per game at a
// team's home park vs. in its road games, over up to five seasons at the
// same park, regressed toward neutral and halved (a team plays half its
// games at home). Checked against FanGraphs' 2025 "Basic (5yr)" factors,
// these land within about a point on average. Against FanGraphs' 2025
// numbers, wRC+ and ERA- came out within ~2 points for every player
// spot-checked.

const AL_LEAGUE_ID = 103;
const NL_LEAGUE_ID = 104;
const STATS_API = "https://statsapi.mlb.com/api/v1";

// Home games of regression toward a neutral park — fit to minimize the gap
// to FanGraphs' 2025 5-year park factors.
const PARK_FACTOR_REGRESSION_GAMES = 100;
const PARK_FACTOR_SEASONS = 5;

type Guts = {
  woba: number;
  scale: number;
  bb: number;
  hbp: number;
  single: number;
  double: number;
  triple: number;
  hr: number;
  runsPerPA: number;
};

// FanGraphs "Guts!" wOBA constants. Seasons outside this table fall back to
// the nearest season's weights, rescaled to that year's league totals (see
// deriveGuts).
const GUTS: Record<number, Guts> = {
  2026: { woba: 0.316, scale: 1.238, bb: 0.698, hbp: 0.729, single: 0.89, double: 1.261, triple: 1.596, hr: 2.049, runsPerPA: 0.118 },
  2025: { woba: 0.313, scale: 1.232, bb: 0.691, hbp: 0.722, single: 0.882, double: 1.252, triple: 1.584, hr: 2.037, runsPerPA: 0.118 },
  2024: { woba: 0.31, scale: 1.242, bb: 0.689, hbp: 0.72, single: 0.882, double: 1.254, triple: 1.59, hr: 2.05, runsPerPA: 0.117 },
  2023: { woba: 0.318, scale: 1.204, bb: 0.696, hbp: 0.726, single: 0.883, double: 1.244, triple: 1.569, hr: 2.004, runsPerPA: 0.122 },
  2022: { woba: 0.31, scale: 1.259, bb: 0.689, hbp: 0.72, single: 0.884, double: 1.261, triple: 1.601, hr: 2.072, runsPerPA: 0.114 },
  2021: { woba: 0.314, scale: 1.209, bb: 0.692, hbp: 0.722, single: 0.879, double: 1.242, triple: 1.568, hr: 2.007, runsPerPA: 0.121 },
  2020: { woba: 0.32, scale: 1.185, bb: 0.699, hbp: 0.728, single: 0.883, double: 1.238, triple: 1.558, hr: 1.979, runsPerPA: 0.125 },
  2019: { woba: 0.32, scale: 1.157, bb: 0.69, hbp: 0.719, single: 0.87, double: 1.217, triple: 1.529, hr: 1.94, runsPerPA: 0.126 },
  2018: { woba: 0.315, scale: 1.226, bb: 0.69, hbp: 0.72, single: 0.88, double: 1.247, triple: 1.578, hr: 2.031, runsPerPA: 0.117 },
  2017: { woba: 0.321, scale: 1.185, bb: 0.693, hbp: 0.723, single: 0.877, double: 1.232, triple: 1.552, hr: 1.98, runsPerPA: 0.122 },
  2016: { woba: 0.318, scale: 1.212, bb: 0.691, hbp: 0.721, single: 0.878, double: 1.242, triple: 1.569, hr: 2.015, runsPerPA: 0.118 },
  2015: { woba: 0.313, scale: 1.251, bb: 0.687, hbp: 0.718, single: 0.881, double: 1.256, triple: 1.594, hr: 2.065, runsPerPA: 0.112 },
  2014: { woba: 0.31, scale: 1.304, bb: 0.689, hbp: 0.722, single: 0.892, double: 1.283, triple: 1.635, hr: 2.135, runsPerPA: 0.107 },
  2013: { woba: 0.314, scale: 1.277, bb: 0.69, hbp: 0.722, single: 0.888, double: 1.271, triple: 1.616, hr: 2.101, runsPerPA: 0.11 },
  2012: { woba: 0.315, scale: 1.245, bb: 0.691, hbp: 0.722, single: 0.884, double: 1.257, triple: 1.593, hr: 2.058, runsPerPA: 0.114 },
  2011: { woba: 0.316, scale: 1.264, bb: 0.694, hbp: 0.726, single: 0.89, double: 1.27, triple: 1.611, hr: 2.086, runsPerPA: 0.112 },
  2010: { woba: 0.321, scale: 1.251, bb: 0.701, hbp: 0.732, single: 0.895, double: 1.27, triple: 1.608, hr: 2.072, runsPerPA: 0.115 },
};

type Totals = Record<string, number>;

type LeagueEnvironment = {
  wrcPerPA: number;
  era: number;
};

export type SeasonEnvironment = {
  guts: Guts;
  leagues: Record<number, LeagueEnvironment>;
  teamLeague: Record<number, number>;
  // Team id → park factor, 1 = neutral (FanGraphs shows 1.03 as "103").
  parkFactors: Record<number, number>;
};

export type SeasonStint = {
  teamId: number;
  stat: StatLine;
};

async function fetchStatsApi<T>(path: string): Promise<T> {
  // Everything here is cached as one computed environment (see
  // getSeasonEnvironment), so skip the per-request data cache — the
  // schedules in particular are large.
  const response = await fetch(`${STATS_API}${path}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`MLB Stats API ${response.status} for ${path}`);
  }

  return (await response.json()) as T;
}

function sumStats(splits: Array<{ stat: Record<string, unknown> }>): Totals {
  const totals: Totals = {};

  for (const split of splits) {
    for (const [key, value] of Object.entries(split.stat)) {
      if (typeof value === "number") {
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }

  return totals;
}

function subtractStats(totals: Totals, other: Totals): Totals {
  const result = { ...totals };

  for (const [key, value] of Object.entries(other)) {
    result[key] = (result[key] ?? 0) - value;
  }

  return result;
}

type WobaInputs = {
  atBats?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  baseOnBalls?: number;
  intentionalWalks?: number;
  hitByPitch?: number;
  sacFlies?: number;
};

function wobaParts(stat: WobaInputs, weights: Omit<Guts, "woba" | "scale" | "runsPerPA">) {
  const doubles = stat.doubles ?? 0;
  const triples = stat.triples ?? 0;
  const homeRuns = stat.homeRuns ?? 0;
  const singles = (stat.hits ?? 0) - doubles - triples - homeRuns;
  const unintentionalWalks = (stat.baseOnBalls ?? 0) - (stat.intentionalWalks ?? 0);
  const hitByPitch = stat.hitByPitch ?? 0;

  return {
    numerator:
      weights.bb * unintentionalWalks +
      weights.hbp * hitByPitch +
      weights.single * singles +
      weights.double * doubles +
      weights.triple * triples +
      weights.hr * homeRuns,
    denominator: (stat.atBats ?? 0) + unintentionalWalks + (stat.sacFlies ?? 0) + hitByPitch,
  };
}

function computeWoba(stat: WobaInputs, guts: Guts): number | null {
  const { numerator, denominator } = wobaParts(stat, guts);
  return denominator > 0 ? numerator / denominator : null;
}

// For a season FanGraphs' table doesn't cover: take the nearest season's
// weights, convert them back to raw run values, and rescale so league wOBA
// equals league OBP — the same scaling FanGraphs applies.
function deriveGuts(season: number, mlbTotals: Totals): Guts {
  const nearestSeason = Object.keys(GUTS)
    .map(Number)
    .reduce((best, year) => (Math.abs(year - season) < Math.abs(best - season) ? year : best));
  const nearest = GUTS[nearestSeason];

  const raw = {
    bb: nearest.bb / nearest.scale,
    hbp: nearest.hbp / nearest.scale,
    single: nearest.single / nearest.scale,
    double: nearest.double / nearest.scale,
    triple: nearest.triple / nearest.scale,
    hr: nearest.hr / nearest.scale,
  };

  const { numerator, denominator } = wobaParts(mlbTotals, raw);
  const onBase = (mlbTotals.hits ?? 0) + (mlbTotals.baseOnBalls ?? 0) + (mlbTotals.hitByPitch ?? 0);
  const obpDenominator =
    (mlbTotals.atBats ?? 0) + (mlbTotals.baseOnBalls ?? 0) + (mlbTotals.hitByPitch ?? 0) + (mlbTotals.sacFlies ?? 0);
  const leagueObp = onBase / obpDenominator;
  const scale = leagueObp / (numerator / denominator);

  return {
    woba: leagueObp,
    scale,
    bb: raw.bb * scale,
    hbp: raw.hbp * scale,
    single: raw.single * scale,
    double: raw.double * scale,
    triple: raw.triple * scale,
    hr: raw.hr * scale,
    runsPerPA: (mlbTotals.runs ?? 0) / (mlbTotals.plateAppearances ?? 1),
  };
}

type ScheduleGame = {
  status: { codedGameState?: string };
  venue: { id: number };
  teams: {
    home: { team: { id: number }; score?: number };
    away: { team: { id: number }; score?: number };
  };
};

async function fetchFinalGames(season: number): Promise<ScheduleGame[]> {
  const fields = "dates,games,status,codedGameState,teams,home,away,team,id,score,venue";
  const data = await fetchStatsApi<{ dates?: Array<{ games?: ScheduleGame[] }> }>(
    `/schedule?sportId=1&season=${season}&gameType=R&fields=${fields}`
  );

  return (data.dates ?? [])
    .flatMap((date) => date.games ?? [])
    .filter((game) => game.status.codedGameState === "F");
}

// The park a team played most of its home games in that season — neutral
// sites (London, Mexico City, Field of Dreams…) don't count as home.
function primaryVenue(games: ScheduleGame[], teamId: number): number | null {
  const counts = new Map<number, number>();

  for (const game of games) {
    if (game.teams.home.team.id === teamId) {
      counts.set(game.venue.id, (counts.get(game.venue.id) ?? 0) + 1);
    }
  }

  let best: number | null = null;
  for (const [venueId, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) {
      best = venueId;
    }
  }

  return best;
}

function computeParkFactors(
  season: number,
  gamesBySeason: Map<number, ScheduleGame[]>,
  teamIds: number[]
): Record<number, number> {
  const factors: Record<number, number> = {};
  const currentGames = gamesBySeason.get(season) ?? [];

  for (const teamId of teamIds) {
    const venueId = primaryVenue(currentGames, teamId);
    if (venueId === null) {
      continue;
    }

    let homeRuns = 0;
    let homeGames = 0;
    let roadRuns = 0;
    let roadGames = 0;

    // Only seasons at the same park count, so a move (e.g. the Athletics
    // to Sacramento) starts the sample over.
    for (const games of gamesBySeason.values()) {
      if (primaryVenue(games, teamId) !== venueId) {
        continue;
      }

      for (const game of games) {
        const runs = (game.teams.home.score ?? 0) + (game.teams.away.score ?? 0);

        if (game.teams.home.team.id === teamId && game.venue.id === venueId) {
          homeRuns += runs;
          homeGames += 1;
        } else if (game.teams.away.team.id === teamId && game.venue.id !== venueId) {
          roadRuns += runs;
          roadGames += 1;
        }
      }
    }

    if (homeGames === 0 || roadGames === 0 || roadRuns === 0) {
      factors[teamId] = 1;
      continue;
    }

    const raw = homeRuns / homeGames / (roadRuns / roadGames);
    const reliability = homeGames / (homeGames + PARK_FACTOR_REGRESSION_GAMES);
    factors[teamId] = 1 + ((raw - 1) * reliability) / 2;
  }

  return factors;
}

type TeamStatsResponse = {
  stats?: Array<{ splits?: Array<{ team: { id: number }; stat: Record<string, unknown> }> }>;
};

type PlayerStatsResponse = {
  stats?: Array<{ splits?: Array<{ stat: Record<string, unknown> }> }>;
};

async function buildSeasonEnvironment(season: number): Promise<SeasonEnvironment> {
  const parkSeasons = Array.from({ length: PARK_FACTOR_SEASONS }, (_, index) => season - index);

  const [teamsData, teamHitting, teamPitching, [alPitcherHitting, nlPitcherHitting], schedules] = await Promise.all([
    fetchStatsApi<{ teams?: Array<{ id: number; league?: { id?: number } }> }>(`/teams?sportId=1&season=${season}`),
    fetchStatsApi<TeamStatsResponse>(`/teams/stats?season=${season}&group=hitting&stats=season&sportIds=1`),
    fetchStatsApi<TeamStatsResponse>(`/teams/stats?season=${season}&group=pitching&stats=season&sportIds=1`),
    // Pitchers batting, to take back out of each league's baseline.
    Promise.all(
      [AL_LEAGUE_ID, NL_LEAGUE_ID].map((leagueId) =>
        fetchStatsApi<PlayerStatsResponse>(
          `/stats?stats=season&group=hitting&season=${season}&sportId=1&leagueIds=${leagueId}&position=P&playerPool=ALL&limit=3000`
        )
      )
    ),
    // A missing season (e.g. before a franchise existed) just shrinks the
    // park factor sample.
    Promise.all(parkSeasons.map((parkSeason) => fetchFinalGames(parkSeason).catch(() => [] as ScheduleGame[]))),
  ]);

  const teamLeague: Record<number, number> = {};
  for (const team of teamsData.teams ?? []) {
    if (team.league?.id) {
      teamLeague[team.id] = team.league.id;
    }
  }

  const hittingSplits = teamHitting.stats?.[0]?.splits ?? [];
  const pitchingSplits = teamPitching.stats?.[0]?.splits ?? [];

  if (hittingSplits.length === 0 || pitchingSplits.length === 0) {
    throw new Error(`No team totals for ${season}`);
  }

  const guts = GUTS[season] ?? deriveGuts(season, sumStats(hittingSplits));

  const pitcherHitting: Record<number, Totals> = {
    [AL_LEAGUE_ID]: sumStats(alPitcherHitting.stats?.[0]?.splits ?? []),
    [NL_LEAGUE_ID]: sumStats(nlPitcherHitting.stats?.[0]?.splits ?? []),
  };

  const leagues: Record<number, LeagueEnvironment> = {};

  for (const leagueId of [AL_LEAGUE_ID, NL_LEAGUE_ID]) {
    const inLeague = (split: { team: { id: number } }) => teamLeague[split.team.id] === leagueId;
    const hitting = subtractStats(sumStats(hittingSplits.filter(inLeague)), pitcherHitting[leagueId]);
    const pitching = sumStats(pitchingSplits.filter(inLeague));
    const leagueWoba = computeWoba(hitting, guts);

    if (leagueWoba === null || !pitching.outs) {
      continue;
    }

    leagues[leagueId] = {
      wrcPerPA: (leagueWoba - guts.woba) / guts.scale + guts.runsPerPA,
      era: ((pitching.earnedRuns ?? 0) * 27) / pitching.outs,
    };
  }

  const gamesBySeason = new Map(parkSeasons.map((parkSeason, index) => [parkSeason, schedules[index]]));
  const parkFactors = computeParkFactors(season, gamesBySeason, Object.keys(teamLeague).map(Number));

  return { guts, leagues, teamLeague, parkFactors };
}

const getCachedSeasonEnvironment = unstable_cache(buildSeasonEnvironment, ["season-environment-v1"], {
  revalidate: 21_600,
});

// League baselines and park factors for a season, or null if the Stats API
// couldn't supply them (the page then just shows "-").
export async function getSeasonEnvironment(season: number): Promise<SeasonEnvironment | null> {
  try {
    return await getCachedSeasonEnvironment(season);
  } catch (error) {
    console.error("getSeasonEnvironment failed", season, error);
    return null;
  }
}

// A traded player's line spans parks and possibly leagues, so blend each
// stint's park factor and league baseline by playing time.
function blendStints(
  stints: SeasonStint[],
  env: SeasonEnvironment,
  weightOf: (stat: StatLine) => number,
  leagueValue: (league: LeagueEnvironment) => number
): { parkFactor: number; league: number } | null {
  let totalWeight = 0;
  let parkFactor = 0;
  let league = 0;

  for (const stint of stints) {
    const leagueEnv = env.leagues[env.teamLeague[stint.teamId]];
    const stintPark = env.parkFactors[stint.teamId];
    const weight = weightOf(stint.stat);

    if (!leagueEnv || stintPark === undefined || weight <= 0) {
      continue;
    }

    totalWeight += weight;
    parkFactor += stintPark * weight;
    league += leagueValue(leagueEnv) * weight;
  }

  return totalWeight > 0 ? { parkFactor: parkFactor / totalWeight, league: league / totalWeight } : null;
}

export function computeWrcPlus(stat: StatLine | null, stints: SeasonStint[], env: SeasonEnvironment): number | null {
  if (!stat || !stat.plateAppearances) {
    return null;
  }

  const woba = computeWoba(stat, env.guts);
  const blend = blendStints(stints, env, (line) => line.plateAppearances ?? 0, (league) => league.wrcPerPA);

  if (woba === null || !blend) {
    return null;
  }

  const { runsPerPA } = env.guts;
  const wraaPerPA = (woba - env.guts.woba) / env.guts.scale;
  const parkAdjustedRunsPerPA = wraaPerPA + runsPerPA + (runsPerPA - blend.parkFactor * runsPerPA);

  return (parkAdjustedRunsPerPA / blend.league) * 100;
}

// Null for a line with no earned runs: ERA+ is infinite there, which isn't
// a useful number to show.
export function computeEraPlus(stat: StatLine | null, stints: SeasonStint[], env: SeasonEnvironment): number | null {
  if (!stat?.outs || !stat.earnedRuns) {
    return null;
  }

  const blend = blendStints(stints, env, (line) => line.outs ?? 0, (league) => league.era);

  if (!blend) {
    return null;
  }

  const era = (stat.earnedRuns * 27) / stat.outs;
  const parkAdjustedEra = era * (2 - blend.parkFactor);

  return (100 * blend.league) / parkAdjustedEra;
}

export function formatPlusStat(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "-" : String(Math.round(value));
}
