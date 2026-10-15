import type { StatLine } from "@/lib/mlb";

// Park- and league-adjusted rate stats (wRC+, ERA+) for any stretch of
// games (rolling trend windows), using a season's context computed on the
// server (lib/war.ts), plus the RA9-WAR math lib/war.ts shares. No
// server-only imports, so the trend chart can run this in the browser.

export type HitterRollingContext = {
  kind: "hitter";
  weights: { bb: number; hbp: number; single: number; double: number; triple: number; hr: number };
  leagueWoba: number;
  wobaScale: number;
  runsPerPA: number;
  parkFactor: number;
  leagueWrcPerPA: number;
};

export type PitcherRollingContext = {
  kind: "pitcher";
  parkFactor: number;
  leagueEra: number;
};

export type RollingContext = HitterRollingContext | PitcherRollingContext;

// FanGraphs' reliever leverage index (gmLI, leverage when entering) isn't
// in the Stats API. Estimate it from how often a reliever's outings were
// save/hold situations — fit to FanGraphs' gmLI for a set of relievers
// (closers ~1.9–2.1, setup ~1.2, low-leverage ~0.65), so it's approximate.
export function estimateGmLI(stat: StatLine): number | null {
  const reliefGames = (stat.gamesPitched ?? 0) - (stat.gamesStarted ?? 0);

  if (reliefGames <= 0) {
    return null;
  }

  const highLeverage = (stat.saves ?? 0) + (stat.holds ?? 0) + (stat.blownSaves ?? 0);
  const estimate = 0.45 + (2.2 * highLeverage) / reliefGames;

  return Math.min(2.5, Math.max(0.5, estimate));
}

export type RawPitcherWar = {
  war: number;
  ra9: number;
  parkAdjustedRa9: number;
  gmLI: number | null;
};

// RA9-WAR before the league-wide 430-win correction.
export function rawPitcherWar(stat: StatLine, parkFactor: number, leagueRa9: number): RawPitcherWar | null {
  const outs = stat.outs ?? 0;
  const games = stat.gamesPitched ?? 0;

  if (outs <= 0 || games <= 0) {
    return null;
  }

  const innings = outs / 3;
  const starts = stat.gamesStarted ?? 0;
  const ra9 = ((stat.runs ?? 0) * 27) / outs;
  const parkAdjustedRa9 = ra9 / parkFactor;
  const inningsPerGame = innings / games;

  // FanGraphs' dynamic runs per win: a pitcher's own run environment
  // changes how many runs a win costs.
  const runsPerWin = (((18 - inningsPerGame) * leagueRa9 + inningsPerGame * parkAdjustedRa9) / 18 + 2) * 1.5;
  const winsPerGameAboveAverage = (leagueRa9 - parkAdjustedRa9) / runsPerWin;
  const startShare = starts / games;
  const replacement = 0.03 * (1 - startShare) + 0.12 * startShare;

  let war = (winsPerGameAboveAverage + replacement) * (innings / 9);

  // Relief value is scaled by leverage, (1 + gmLI) / 2, for the share of
  // outings that were in relief.
  const gmLI = estimateGmLI(stat);
  if (gmLI !== null) {
    war *= 1 + (1 - startShare) * ((1 + gmLI) / 2 - 1);
  }

  return { war, ra9, parkAdjustedRa9, gmLI: startShare < 0.5 ? gmLI : null };
}

function battingRunsPerPA(stat: StatLine, context: HitterRollingContext): number | null {
  const doubles = stat.doubles ?? 0;
  const triples = stat.triples ?? 0;
  const homeRuns = stat.homeRuns ?? 0;
  const singles = (stat.hits ?? 0) - doubles - triples - homeRuns;
  const unintentionalWalks = (stat.baseOnBalls ?? 0) - (stat.intentionalWalks ?? 0);
  const hitByPitch = stat.hitByPitch ?? 0;
  const denominator = (stat.atBats ?? 0) + unintentionalWalks + (stat.sacFlies ?? 0) + hitByPitch;

  if (denominator <= 0) {
    return null;
  }

  const { weights } = context;
  const woba =
    (weights.bb * unintentionalWalks +
      weights.hbp * hitByPitch +
      weights.single * singles +
      weights.double * doubles +
      weights.triple * triples +
      weights.hr * homeRuns) /
    denominator;

  return (woba - context.leagueWoba) / context.wobaScale;
}

export function rollingWrcPlus(stat: StatLine, context: HitterRollingContext): number | null {
  const wraaPerPA = battingRunsPerPA(stat, context);

  if (wraaPerPA === null || !stat.plateAppearances) {
    return null;
  }

  const { runsPerPA, parkFactor } = context;
  return ((wraaPerPA + runsPerPA + (runsPerPA - parkFactor * runsPerPA)) / context.leagueWrcPerPA) * 100;
}

export function rollingEraPlus(stat: StatLine, context: PitcherRollingContext): number | null {
  if (!stat.outs || !stat.earnedRuns) {
    return null;
  }

  const era = (stat.earnedRuns * 27) / stat.outs;
  return (100 * context.leagueEra) / (era * (2 - context.parkFactor));
}
