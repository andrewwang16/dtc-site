import { unstable_cache } from "next/cache";
import type { StatLine } from "@/lib/mlb";
import {
  AL_LEAGUE_ID,
  NL_LEAGUE_ID,
  computeWoba,
  fetchStatsApi,
  getSeasonEnvironment,
  sumStats,
  type LeagueEnvironment,
  type PlayerStatsResponse,
  type SeasonEnvironment,
  type SeasonStint,
  type TeamStatsResponse,
} from "@/lib/park-adjusted";
import {
  rawPitcherWar,
  type HitterRollingContext,
  type PitcherRollingContext,
} from "@/lib/rolling-advanced";

// Wins Above Replacement, following FanGraphs' published method — position
// players the way fWAR is built, pitchers the way FanGraphs builds its
// RA9-WAR (runs allowed, not FIP).
//
// Position players:
//   WAR = (Batting + Baserunning + Fielding + Positional + League + Replacement) / Runs per win
//   - Batting: park- and league-adjusted wRAA (same inputs as wRC+).
//   - Baserunning: wSB (steals/caught stealing vs. league rate) + Statcast
//     extra-bases-taken runs, which is what FanGraphs' UBR now matches.
//     FanGraphs' small double-play component (wGDP) is left out — the API
//     doesn't expose double-play opportunities, and estimates of them
//     tracked FanGraphs worse than leaving it at zero.
//   - Fielding: Statcast Fielding Run Value (range, arm, double plays,
//     catcher framing/blocking/throwing), which FanGraphs adopted for WAR.
//   - Positional: FanGraphs' per-1,458-inning adjustments, prorated by
//     innings at each spot (DH by games).
//   - League: zeroes each league's total above-average value.
//   - Replacement: 570 of every 1,000 WAR go to position players.
//
// Pitchers (RA9-WAR):
//   park-adjusted RA9 vs. league RA9, converted with FanGraphs' dynamic
//   runs-per-win, plus a replacement level that blends starter (.12 wins
//   per 9) and reliever (.03) roles, a leverage multiplier for relievers,
//   and a final per-inning correction so all pitchers total 430 WAR.
//
// Statcast fielding/baserunning data starts in 2016; earlier seasons get
// zero for those two pieces. Checked against FanGraphs' 2025 numbers,
// position-player WAR landed within 0.6 for every player spot-checked
// (most within 0.2) — the remaining gap is mostly fielding, where
// FanGraphs' figures differ from Statcast's by a few runs either way.

const RUN_SB = 0.2;
const POSITION_PLAYER_WAR_PER_SEASON = 570;
const PITCHER_WAR_PER_SEASON = 430;
const FULL_SEASON_GAMES = 2430;
const STATCAST_FIRST_SEASON = 2016;

// Runs per 162 defensive games (1,458 innings).
const POSITIONAL_RUNS: Record<string, number> = {
  C: 12.5,
  "1B": -12.5,
  "2B": 2.5,
  SS: 7.5,
  "3B": 2.5,
  LF: -7.5,
  CF: 2.5,
  RF: -7.5,
  DH: -17.5,
};

const SAVANT_USER_AGENT = "Mozilla/5.0 (compatible; DealinTheCards/1.0)";

type WarEnvironment = {
  base: SeasonEnvironment;
  lgwSB: number;
  replacementRunsPerPA: number;
  leagueAdjustmentPerPA: Record<number, number>;
  leagueRa9: Record<number, number>;
  pitcherCorrectionPerOut: number;
  hasStatcast: boolean;
  fieldingRuns: Record<number, number>;
  extraBaseRuns: Record<number, number>;
};

export type PositionPlayerWar = {
  war: number;
  batting: number;
  baserunning: number;
  fielding: number;
  positional: number;
  league: number;
  replacement: number;
  hasStatcast: boolean;
  rollingContext: HitterRollingContext;
};

export type PitcherWar = {
  war: number;
  ra9: number;
  parkAdjustedRa9: number;
  leagueRa9: number;
  // Estimated entry leverage, only for pitchers who mostly relieved.
  gmLI: number | null;
  rollingContext: PitcherRollingContext;
};

export type FieldingSplit = {
  teamId: number;
  position: string;
  innings: number;
  games: number;
};

// Every team has a DH in the AL (since 1973), and in the NL in 2020 and
// from 2022 on.
function leagueUsesDh(leagueId: number, season: number) {
  return leagueId === AL_LEAGUE_ID || season === 2020 || season >= 2022;
}

// "822.1" innings means 822⅓.
function parseInnings(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const [whole, partial] = value.split(".");
  return Number(whole) + Number(partial ?? 0) / 3;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows;
  if (!header) {
    return [];
  }

  const keys = header.map((key) => key.replace(/^﻿/, "").trim());
  return body
    .filter((cells) => cells.length === keys.length)
    .map((cells) => Object.fromEntries(keys.map((key, index) => [key, cells[index]])));
}

async function fetchSavantRuns(url: string, idColumn: string, runsColumn: string): Promise<Record<number, number>> {
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": SAVANT_USER_AGENT } });

  if (!response.ok) {
    throw new Error(`Savant ${response.status} for ${url}`);
  }

  const runs: Record<number, number> = {};
  for (const row of parseCsv(await response.text())) {
    const id = Number(row[idColumn]);
    const value = Number(row[runsColumn]);
    if (Number.isFinite(id) && Number.isFinite(value)) {
      runs[id] = (runs[id] ?? 0) + value;
    }
  }

  return runs;
}

// Fielding Run Value and extra-bases-taken baserunning runs for every
// player in a season. Missing data (pre-2016, or Savant down) just leaves
// those components at zero.
async function fetchStatcastRuns(season: number) {
  if (season < STATCAST_FIRST_SEASON) {
    return { hasStatcast: false, fieldingRuns: {}, extraBaseRuns: {} };
  }

  try {
    const [fieldingRuns, extraBaseRuns] = await Promise.all([
      fetchSavantRuns(
        `https://baseballsavant.mlb.com/leaderboard/fielding-run-value?gameType=Regular&seasonStart=${season}&seasonEnd=${season}&type=fielder&position=&minInnings=0&minResults=1&csv=true`,
        "id",
        "total_runs"
      ),
      fetchSavantRuns(
        `https://baseballsavant.mlb.com/leaderboard/baserunning-run-value?game_type=Regular&n=0&season_start=${season}&season_end=${season}&sortColumn=runner_runs_tot&sortDirection=desc&split=no&team=&type=Run&with_team_only=1&csv=true`,
        "player_id",
        "runner_runs_XB"
      ),
    ]);

    const hasStatcast = Object.keys(fieldingRuns).length > 0;
    return { hasStatcast, fieldingRuns, extraBaseRuns };
  } catch (error) {
    console.error("fetchStatcastRuns failed", season, error);
    return { hasStatcast: false, fieldingRuns: {}, extraBaseRuns: {} };
  }
}

type TeamSplit = { team: { id: number }; stat: Record<string, unknown> };
type PlayerTeamSplit = { team?: { id: number }; stat: StatLine };

async function buildWarEnvironment(season: number): Promise<WarEnvironment> {
  const base = await getSeasonEnvironment(season);

  if (!base) {
    throw new Error(`No season environment for ${season}`);
  }

  const [teamHitting, teamPitching, leaguePitchers, statcast] = await Promise.all([
    fetchStatsApi<TeamStatsResponse>(`/teams/stats?season=${season}&group=hitting&stats=season&sportIds=1`),
    fetchStatsApi<TeamStatsResponse>(`/teams/stats?season=${season}&group=pitching&stats=season&sportIds=1`),
    Promise.all(
      [AL_LEAGUE_ID, NL_LEAGUE_ID].map((leagueId) =>
        fetchStatsApi<PlayerStatsResponse>(
          `/stats?stats=season&group=pitching&season=${season}&sportId=1&leagueIds=${leagueId}&playerPool=ALL&limit=5000`
        )
      )
    ),
    fetchStatcastRuns(season),
  ]);

  const hittingSplits: TeamSplit[] = teamHitting.stats?.[0]?.splits ?? [];
  const pitchingSplits: TeamSplit[] = teamPitching.stats?.[0]?.splits ?? [];
  const { guts, teamLeague, parkFactors, leagues } = base;

  const mlbHitting = sumStats(hittingSplits);
  const mlbPA = mlbHitting.plateAppearances ?? 0;
  const mlbGames = hittingSplits.reduce((sum, split) => sum + Number(split.stat.gamesPlayed ?? 0), 0) / 2;

  if (!mlbPA || !mlbGames) {
    throw new Error(`No league totals for ${season}`);
  }

  const singles =
    (mlbHitting.hits ?? 0) - (mlbHitting.doubles ?? 0) - (mlbHitting.triples ?? 0) - (mlbHitting.homeRuns ?? 0);
  const lgwSB =
    ((mlbHitting.stolenBases ?? 0) * RUN_SB + (mlbHitting.caughtStealing ?? 0) * guts.runCS) /
    (singles + (mlbHitting.baseOnBalls ?? 0) + (mlbHitting.hitByPitch ?? 0) - (mlbHitting.intentionalWalks ?? 0));

  const replacementRunsPerPA =
    (POSITION_PLAYER_WAR_PER_SEASON * (mlbGames / FULL_SEASON_GAMES) * guts.runsPerWin) / mlbPA;

  const leagueAdjustmentPerPA: Record<number, number> = {};
  const leagueRa9: Record<number, number> = {};

  for (const leagueId of [AL_LEAGUE_ID, NL_LEAGUE_ID]) {
    const leagueEnv: LeagueEnvironment | undefined = leagues[leagueId];
    const teams = hittingSplits.filter((split) => teamLeague[split.team.id] === leagueId);
    const pitching = sumStats(pitchingSplits.filter((split) => teamLeague[split.team.id] === leagueId));

    if (!leagueEnv || teams.length === 0 || !pitching.outs) {
      continue;
    }

    // The league adjustment zeroes out each league's total batting and
    // positional value among non-pitchers (baserunning and fielding already
    // net to ~zero). Across a league's non-pitchers, the wRAA and league
    // terms of batting runs cancel by construction, leaving the park term.
    let parkRuns = 0;
    let teamPA = 0;
    let teamGames = 0;

    for (const team of teams) {
      const totals = sumStats([team]);
      const pa = totals.plateAppearances ?? 0;
      parkRuns += (guts.runsPerPA - (parkFactors[team.team.id] ?? 1) * guts.runsPerPA) * pa;
      teamPA += pa;
      teamGames += totals.gamesPlayed ?? 0;
    }

    const plateAppearances = leagueEnv.plateAppearances;
    const battingRuns = teamPA > 0 ? parkRuns * (plateAppearances / teamPA) : 0;
    const positionalRuns = leagueUsesDh(leagueId, season) ? (POSITIONAL_RUNS.DH / 162) * teamGames : 0;

    leagueAdjustmentPerPA[leagueId] = -(battingRuns + positionalRuns) / plateAppearances;
    leagueRa9[leagueId] = ((pitching.runs ?? 0) * 27) / pitching.outs;
  }

  // Scale pitchers so they total 430 WAR per 2,430 games, spread evenly by
  // innings — the same final step FanGraphs applies.
  let pitcherWar = 0;
  let pitcherOuts = 0;

  for (const response of leaguePitchers) {
    for (const split of (response.stats?.[0]?.splits ?? []) as PlayerTeamSplit[]) {
      const teamId = split.team?.id;
      const league = teamId ? leagueRa9[teamLeague[teamId]] : undefined;

      if (!teamId || league === undefined) {
        continue;
      }

      const raw = rawPitcherWar(split.stat, parkFactors[teamId] ?? 1, league);
      if (raw) {
        pitcherWar += raw.war;
        pitcherOuts += split.stat.outs ?? 0;
      }
    }
  }

  const pitcherTarget = PITCHER_WAR_PER_SEASON * (mlbGames / FULL_SEASON_GAMES);
  const pitcherCorrectionPerOut = pitcherOuts > 0 ? (pitcherTarget - pitcherWar) / pitcherOuts : 0;

  return {
    base,
    lgwSB,
    replacementRunsPerPA,
    leagueAdjustmentPerPA,
    leagueRa9,
    pitcherCorrectionPerOut,
    ...statcast,
  };
}

const getCachedWarEnvironment = unstable_cache(buildWarEnvironment, ["war-environment-v2"], {
  revalidate: 21_600,
});

async function getWarEnvironment(season: number): Promise<WarEnvironment | null> {
  try {
    return await getCachedWarEnvironment(season);
  } catch (error) {
    console.error("getWarEnvironment failed", season, error);
    return null;
  }
}

// Innings (and games, for DH) at each position, per team.
export async function getFieldingSplits(playerId: number, season: number): Promise<FieldingSplit[]> {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=fielding&season=${season}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      return [];
    }

    const data: {
      stats?: Array<{
        splits?: Array<{
          team?: { id: number };
          position?: { abbreviation?: string };
          stat?: { innings?: string; gamesPlayed?: number };
        }>;
      }>;
    } = await response.json();

    return (data.stats?.[0]?.splits ?? [])
      .filter((split) => split.team && split.position?.abbreviation)
      .map((split) => ({
        teamId: split.team!.id,
        position: split.position!.abbreviation!,
        innings: parseInnings(split.stat?.innings),
        games: split.stat?.gamesPlayed ?? 0,
      }));
  } catch {
    return [];
  }
}

function weightedAverage(stints: SeasonStint[], weightOf: (stat: StatLine) => number, valueOf: (stint: SeasonStint) => number | undefined) {
  let totalWeight = 0;
  let total = 0;

  for (const stint of stints) {
    const weight = weightOf(stint.stat);
    const value = valueOf(stint);

    if (weight > 0 && value !== undefined) {
      totalWeight += weight;
      total += value * weight;
    }
  }

  return totalWeight > 0 ? total / totalWeight : null;
}

// `seasonPA` is the player's full-season PA: Statcast fielding and
// baserunning are season totals, so a single team stint gets a PA-based
// share of them. `positionalShare` does the same for the positional
// adjustment, whose innings are already per team stint but not per split.
function positionPlayerWar(
  playerId: number,
  stat: StatLine,
  stints: SeasonStint[],
  fielding: FieldingSplit[],
  seasonPA: number,
  env: WarEnvironment,
  positionalShare = 1
): PositionPlayerWar | null {
  const pa = stat.plateAppearances ?? 0;
  const { guts, parkFactors, leagues, teamLeague } = env.base;

  if (pa <= 0) {
    return null;
  }

  const plateAppearances = (line: StatLine) => line.plateAppearances ?? 0;
  const parkFactor = weightedAverage(stints, plateAppearances, (stint) => parkFactors[stint.teamId]);
  const leagueWrcPerPA = weightedAverage(stints, plateAppearances, (stint) => leagues[teamLeague[stint.teamId]]?.wrcPerPA);
  const leagueAdjustmentPerPA = weightedAverage(
    stints,
    plateAppearances,
    (stint) => env.leagueAdjustmentPerPA[teamLeague[stint.teamId]]
  );
  const woba = computeWoba(stat, guts);

  if (parkFactor === null || leagueWrcPerPA === null || leagueAdjustmentPerPA === null || woba === null) {
    return null;
  }

  const batting =
    ((woba - guts.woba) / guts.scale) * pa +
    (guts.runsPerPA - parkFactor * guts.runsPerPA) * pa +
    (guts.runsPerPA - leagueWrcPerPA) * pa;

  const singles = (stat.hits ?? 0) - (stat.doubles ?? 0) - (stat.triples ?? 0) - (stat.homeRuns ?? 0);
  const stolenBaseRuns =
    (stat.stolenBases ?? 0) * RUN_SB +
    (stat.caughtStealing ?? 0) * guts.runCS -
    env.lgwSB * (singles + (stat.baseOnBalls ?? 0) + (stat.hitByPitch ?? 0) - (stat.intentionalWalks ?? 0));

  const statcastShare = seasonPA > 0 ? Math.min(1, pa / seasonPA) : 1;
  const baserunning = stolenBaseRuns + (env.extraBaseRuns[playerId] ?? 0) * statcastShare;
  const fieldingRuns = (env.fieldingRuns[playerId] ?? 0) * statcastShare;

  const stintTeams = new Set(stints.map((stint) => stint.teamId));
  const positional = fielding
    .filter((split) => stintTeams.has(split.teamId))
    .reduce((sum, split) => {
      const runs = POSITIONAL_RUNS[split.position];
      if (runs === undefined) {
        return sum;
      }
      // A DH plays no defensive innings, so count each DH game as nine.
      const innings = split.position === "DH" ? split.games * 9 : split.innings;
      return sum + (innings / 1458) * runs * positionalShare;
    }, 0);

  const league = leagueAdjustmentPerPA * pa;
  const replacement = env.replacementRunsPerPA * pa;
  const runs = batting + baserunning + fieldingRuns + positional + league + replacement;

  return {
    war: runs / guts.runsPerWin,
    batting,
    baserunning,
    fielding: fieldingRuns,
    positional,
    league,
    replacement,
    hasStatcast: env.hasStatcast,
    rollingContext: {
      kind: "hitter",
      weights: {
        bb: guts.bb,
        hbp: guts.hbp,
        single: guts.single,
        double: guts.double,
        triple: guts.triple,
        hr: guts.hr,
      },
      leagueWoba: guts.woba,
      wobaScale: guts.scale,
      runsPerPA: guts.runsPerPA,
      parkFactor,
      leagueWrcPerPA,
    },
  };
}

function pitcherWar(stat: StatLine, stints: SeasonStint[], env: WarEnvironment): PitcherWar | null {
  const outs = (line: StatLine) => line.outs ?? 0;
  const { parkFactors, teamLeague, leagues } = env.base;
  const parkFactor = weightedAverage(stints, outs, (stint) => parkFactors[stint.teamId]);
  const leagueRa9 = weightedAverage(stints, outs, (stint) => env.leagueRa9[teamLeague[stint.teamId]]);
  const leagueEra = weightedAverage(stints, outs, (stint) => leagues[teamLeague[stint.teamId]]?.era);

  if (parkFactor === null || leagueRa9 === null || leagueEra === null) {
    return null;
  }

  const raw = rawPitcherWar(stat, parkFactor, leagueRa9);

  if (!raw) {
    return null;
  }

  return {
    war: raw.war + env.pitcherCorrectionPerOut * (stat.outs ?? 0),
    ra9: raw.ra9,
    parkAdjustedRa9: raw.parkAdjustedRa9,
    leagueRa9,
    gmLI: raw.gmLI,
    rollingContext: {
      kind: "pitcher",
      parkFactor,
      leagueEra,
    },
  };
}

export async function getPositionPlayerWar(
  playerId: number,
  season: number,
  stat: StatLine | null,
  stints: SeasonStint[],
  seasonPA: number
): Promise<PositionPlayerWar | null> {
  if (!stat || stints.length === 0) {
    return null;
  }

  const [env, fielding] = await Promise.all([getWarEnvironment(season), getFieldingSplits(playerId, season)]);
  return env ? positionPlayerWar(playerId, stat, stints, fielding, seasonPA, env) : null;
}

export async function getPitcherWar(
  season: number,
  stat: StatLine | null,
  stints: SeasonStint[]
): Promise<PitcherWar | null> {
  if (!stat || stints.length === 0) {
    return null;
  }

  const env = await getWarEnvironment(season);
  return env ? pitcherWar(stat, stints, env) : null;
}

// WAR for parts of a season (months, handedness or home/away splits), on
// the full season's park and league context, the way FanGraphs splits it.
// Season-total pieces (Statcast fielding and baserunning, the positional
// adjustment) are prorated by the split's share of season PA.
export async function getPositionPlayerSplitWar(
  playerId: number,
  season: number,
  splits: Array<StatLine | null>,
  stints: SeasonStint[],
  seasonPA: number
): Promise<Array<number | null>> {
  if (stints.length === 0 || seasonPA <= 0) {
    return splits.map(() => null);
  }

  const [env, fielding] = await Promise.all([getWarEnvironment(season), getFieldingSplits(playerId, season)]);

  return splits.map((stat) => {
    if (!env || !stat) {
      return null;
    }
    const share = Math.min(1, (stat.plateAppearances ?? 0) / seasonPA);
    return positionPlayerWar(playerId, stat, stints, fielding, seasonPA, env, share)?.war ?? null;
  });
}

// Pitching splits by batter hand don't include runs allowed, so RA9-WAR
// can't be computed for them — those come back null rather than as if no
// runs scored.
export async function getPitcherSplitWar(
  season: number,
  splits: Array<StatLine | null>,
  stints: SeasonStint[]
): Promise<Array<number | null>> {
  if (stints.length === 0) {
    return splits.map(() => null);
  }

  const env = await getWarEnvironment(season);

  return splits.map((stat) =>
    env && stat && stat.runs !== undefined && stat.runs !== null ? pitcherWar(stat, stints, env)?.war ?? null : null
  );
}

export function formatWar(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "-" : value.toFixed(1);
}
