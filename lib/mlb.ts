export const CARDINALS_TEAM_ID = 138;

// MLB bio data often includes accent marks ("Iván Herrera", "Joshua Báez")
// that a search box won't be typed with — strip diacritics from both sides
// before comparing so plain-ASCII queries still match.
export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function playerHeadshotUrl(playerId: number, width = 160) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${width},q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

export function teamLogoUrl(teamId: number) {
  return `https://www.mlbstatic.com/team-logos/team-cap-on-light/${teamId}.svg`;
}

const TEAM_ABBREVIATIONS: Record<number, string> = {
  108: "LAA",
  109: "AZ",
  110: "BAL",
  111: "BOS",
  112: "CHC",
  113: "CIN",
  114: "CLE",
  115: "COL",
  116: "DET",
  117: "HOU",
  118: "KC",
  119: "LAD",
  120: "WSH",
  121: "NYM",
  133: "ATH",
  134: "PIT",
  135: "SD",
  136: "SEA",
  137: "SF",
  138: "STL",
  139: "TB",
  140: "TEX",
  141: "TOR",
  142: "MIN",
  143: "PHI",
  144: "ATL",
  145: "CWS",
  146: "MIA",
  147: "NYY",
  158: "MIL",
};

// All 30 MLB team ids.
export const MLB_TEAM_IDS = Object.keys(TEAM_ABBREVIATIONS).map(Number);

export function getTeamAbbreviation(teamId: number, fallbackName?: string): string {
  return (
    TEAM_ABBREVIATIONS[teamId] ??
    fallbackName?.slice(0, 3).toUpperCase() ??
    "MLB"
  );
}

export type StatGroup = "hitting" | "pitching";

export type PlayerRole = "Hitter" | "Pitcher";

export type PlayerBio = {
  id: number;
  fullName: string;
  primaryNumber?: string;
  birthDate?: string;
  birthCity?: string;
  birthStateProvince?: string;
  birthCountry?: string;
  height?: string;
  weight?: number;
  batSide?: { code: string; description: string };
  pitchHand?: { code: string; description: string };
  primaryPosition?: { code: string; name: string; abbreviation: string };
  draftYear?: number;
  mlbDebutDate?: string;
  currentTeam?: { id: number; name: string };
  drafts?: Array<{
    pickRound: string;
    pickNumber: number;
    roundPickNumber: number;
    team?: { id: number; name: string };
    isDrafted: boolean;
    year: string;
  }>;
  transactions?: Array<{
    toTeam?: { id: number; name: string };
    date: string;
    typeCode: string;
    typeDesc: string;
  }>;
};

export type StatLine = {
  gamesPlayed?: number;
  gamesPitched?: number;
  gamesStarted?: number;
  plateAppearances?: number;
  battersFaced?: number;
  atBats?: number;
  hits?: number;
  runs?: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  rbi?: number;
  stolenBases?: number;
  caughtStealing?: number;
  baseOnBalls?: number;
  intentionalWalks?: number;
  strikeOuts?: number;
  hitByPitch?: number;
  sacFlies?: number;
  totalBases?: number;
  avg?: string;
  obp?: string;
  slg?: string;
  ops?: string;
  era?: string;
  whip?: string;
  inningsPitched?: string;
  wins?: number;
  losses?: number;
  saves?: number;
  holds?: number;
  blownSaves?: number;
  gamesFinished?: number;
  homeRunsPer9?: string;
  earnedRuns?: number;
  outs?: number;
};

export type MonthSplit = {
  month: string;
  stat: StatLine;
};

export type SituationSplit = {
  code: string;
  description: string;
  stat: StatLine;
};

export type GameLogEntry = {
  date: string;
  gamePk: number;
  opponentId: number;
  opponentName: string;
  isHome: boolean;
  isWin?: boolean;
  summary?: string;
  stat: StatLine;
};

export type RosterEntry = {
  id: number;
  fullName: string;
  // The API's display last name, which keeps multi-word surnames and
  // suffixes intact ("Scott II", "De La Cruz") — splitting fullName on
  // spaces can't recover those.
  lastName?: string;
  position: string;
  debutDate?: string;
  // Batting side (L/R/S) and throwing hand (L/R).
  bats?: string;
  throws?: string;
  jerseyNumber?: string;
  status?: string;
};

export type RosterType = "active" | "40Man" | "fullSeason";

async function fetchJson<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const response = await fetch(url, { next: { revalidate } });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getPlayerBio(playerId: number): Promise<PlayerBio | null> {
  const data = await fetchJson<{ people?: PlayerBio[] }>(
    `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=currentTeam,draft,transactions`,
    86400
  );

  return data?.people?.[0] ?? null;
}

export function getCardinalsRoster(year: number, rosterType: RosterType = "fullSeason"): Promise<RosterEntry[]> {
  return getTeamRoster(CARDINALS_TEAM_ID, year, rosterType);
}

export async function getTeamRoster(
  teamId: number,
  year: number,
  rosterType: RosterType = "fullSeason"
): Promise<RosterEntry[]> {
  const data = await fetchJson<{
    roster?: Array<{
      person: {
        id: number;
        fullName: string;
        useLastName?: string;
        mlbDebutDate?: string;
        batSide?: { code?: string };
        pitchHand?: { code?: string };
      };
      position: { abbreviation: string };
      jerseyNumber?: string;
      status?: { description?: string };
    }>;
  }>(
    `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=${rosterType}&season=${year}&hydrate=person`,
    3600
  );

  return (data?.roster ?? []).map((entry) => ({
    id: entry.person.id,
    fullName: entry.person.fullName,
    lastName: entry.person.useLastName,
    position: entry.position.abbreviation,
    debutDate: entry.person.mlbDebutDate,
    bats: entry.person.batSide?.code,
    throws: entry.person.pitchHand?.code,
    jerseyNumber: entry.jerseyNumber,
    status: entry.status?.description,
  }));
}

export type FortyManSplit = {
  active: RosterEntry[];
  sixtyDayIL: RosterEntry[];
};

// A 60-day IL stint actually opens a 40-man spot, but the Stats API's
// "40Man" roster type still lists those players (with a 60-Day status) —
// so we split them back out here rather than trusting the raw list, and
// also check the full-season roster in case a 60-day IL player has fallen
// off the 40Man listing entirely.
export async function getFortyManSplit(year: number, teamId = CARDINALS_TEAM_ID): Promise<FortyManSplit> {
  const [rawFortyMan, fullSeason] = await Promise.all([
    getTeamRoster(teamId, year, "40Man"),
    getTeamRoster(teamId, year, "fullSeason"),
  ]);

  const isSixtyDayIL = (player: RosterEntry) => player.status?.includes("60-Day") ?? false;

  const active = rawFortyMan.filter((player) => !isSixtyDayIL(player));

  const sixtyDayIL = new Map<number, RosterEntry>();
  for (const player of rawFortyMan) if (isSixtyDayIL(player)) sixtyDayIL.set(player.id, player);
  for (const player of fullSeason) if (isSixtyDayIL(player)) sixtyDayIL.set(player.id, player);

  return { active, sixtyDayIL: [...sixtyDayIL.values()] };
}

export type ExternalPlayer = {
  id: number;
  fullName: string;
  lastName?: string;
  position: string;
  bats?: string;
  throws?: string;
  teamId?: number;
};

// Every active MLB player league-wide, for the roster builder's "external
// player" search (adding someone from outside the organization). Cached
// for hours since this list barely changes day to day.
export async function getAllMlbPlayers(year: number): Promise<ExternalPlayer[]> {
  const data = await fetchJson<{
    people?: Array<{
      id: number;
      fullName: string;
      useLastName?: string;
      batSide?: { code?: string };
      pitchHand?: { code?: string };
      primaryPosition?: { abbreviation?: string };
      currentTeam?: { id?: number };
    }>;
  }>(`https://statsapi.mlb.com/api/v1/sports/1/players?season=${year}`, 21_600);

  return (data?.people ?? []).map((person) => ({
    id: person.id,
    fullName: person.fullName,
    lastName: person.useLastName,
    bats: person.batSide?.code,
    throws: person.pitchHand?.code,
    position: person.primaryPosition?.abbreviation ?? "",
    teamId: person.currentTeam?.id,
  }));
}

export type NotablePlayer = {
  id: number;
  fullName: string;
  position: string;
  avg: string;
  homeRuns: number;
  rbi: number;
  ops: string;
};

const MIN_NOTABLE_PLATE_APPEARANCES = 150;
const QUALIFIED_PA_PER_GAME = 3.1;

export async function getTeamNotablePositionPlayers(
  teamId: number,
  year: number,
  limit = 3
): Promise<NotablePlayer[]> {
  const data = await fetchJson<{
    roster?: Array<{
      person: {
        id: number;
        fullName: string;
        stats?: Array<{ splits?: Array<{ stat?: Record<string, any> }> }>;
      };
      position: { abbreviation: string };
    }>;
  }>(
    `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person(stats(type=season,group=hitting,season=${year}))`,
    3600
  );

  const candidates = (data?.roster ?? [])
    .filter((entry) => entry.position.abbreviation !== "P")
    .map((entry) => {
      const stat = entry.person.stats?.[0]?.splits?.[0]?.stat;
      const gamesPlayed: number = stat?.gamesPlayed ?? 0;
      const plateAppearances: number = stat?.plateAppearances ?? 0;
      const ops: string | undefined = stat?.ops;

      return {
        id: entry.person.id,
        fullName: entry.person.fullName,
        position: entry.position.abbreviation,
        avg: (stat?.avg as string | undefined) ?? "-",
        homeRuns: stat?.homeRuns ?? 0,
        rbi: stat?.rbi ?? 0,
        ops: ops ?? "-",
        gamesPlayed,
        plateAppearances,
        opsValue: parseStatNumber(ops),
      };
    });

  // Approximate the batting-title qualification threshold (3.1 PA per team
  // game) from the most games any hitter on this roster has played, since a
  // dedicated team-games-played lookup isn't worth another API call here.
  const approxTeamGames = Math.max(
    0,
    ...candidates.map((player) => player.gamesPlayed)
  );

  const qualifiedPA = Math.ceil(approxTeamGames * QUALIFIED_PA_PER_GAME);

  const eligible = candidates.filter(
    (player) =>
      player.plateAppearances >= qualifiedPA ||
      player.plateAppearances >= MIN_NOTABLE_PLATE_APPEARANCES
  );

  eligible.sort((a, b) => b.opsValue - a.opsValue);

  return eligible
    .slice(0, limit)
    .map(({ id, fullName, position, avg, homeRuns, rbi, ops }) => ({
      id,
      fullName,
      position,
      avg,
      homeRuns,
      rbi,
      ops,
    }));
}

type RawStatsResponse = {
  stats?: Array<{
    type: { displayName: string };
    splits: Array<Record<string, any>>;
  }>;
};

export function determinePlayerRole(bio: PlayerBio): PlayerRole {
  return bio.primaryPosition?.abbreviation === "P" ? "Pitcher" : "Hitter";
}

export type SeasonTeamStint = {
  teamId: number;
  teamName: string;
  stat: StatLine;
};

export type PlayerYearStats = {
  season: StatLine | null;
  seasonTeams: SeasonTeamStint[];
  months: MonthSplit[];
  gameLog: GameLogEntry[];
};

// Every season a player actually recorded a stat line for, in one call —
// used to trim the year-picker dropdown down from a flat debut-to-now
// range, which otherwise includes years a long-retired or injured player
// never played.
export async function getPlayerCareerYears(playerId: number, group: StatGroup): Promise<Set<number>> {
  const data = await fetchJson<{ stats?: Array<{ splits?: Array<{ season?: string }> }> }>(
    `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=yearByYear&group=${group}`,
    86400
  );

  const splits = data?.stats?.[0]?.splits ?? [];

  return new Set(
    splits
      .map((split) => Number.parseInt(split.season ?? "", 10))
      .filter((season) => Number.isFinite(season))
  );
}

export async function getPlayerYearStats(
  playerId: number,
  year: number,
  group: StatGroup
): Promise<PlayerYearStats> {
  const data = await fetchJson<RawStatsResponse>(
    `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season,byMonth,gameLog&group=${group}&season=${year}`,
    3600
  );

  const seasonBlock = data?.stats?.find((block) => block.type.displayName === "season");
  const monthBlock = data?.stats?.find((block) => block.type.displayName === "byMonth");
  const gameLogBlock = data?.stats?.find((block) => block.type.displayName === "gameLog");

  // A player traded mid-season gets one split per team stint *plus* a
  // combined split with no `team` attached — keep the combined one as the
  // season total, and expose the per-team stints separately so the page can
  // offer a "2TM" combined view alongside each individual team's line.
  const seasonSplits = seasonBlock?.splits ?? [];

  const aggregateSplit = seasonSplits.find((split) => !split.team);
  const teamSplits = seasonSplits.filter((split) => split.team);

  const season =
    (aggregateSplit?.stat as StatLine | undefined) ??
    (teamSplits[0]?.stat as StatLine | undefined) ??
    null;

  const seasonTeams: SeasonTeamStint[] = teamSplits.map((split) => ({
    teamId: split.team.id,
    teamName: split.team.name,
    stat: split.stat as StatLine,
  }));

  const months: MonthSplit[] = (monthBlock?.splits ?? [])
    .slice()
    .sort((a, b) => Number(b.month) - Number(a.month))
    .map((split) => ({
      month: MONTH_NAMES[Number(split.month) - 1] ?? `Month ${split.month}`,
      stat: split.stat as StatLine,
    }));

  const gameLog: GameLogEntry[] = (gameLogBlock?.splits ?? []).map((split) => ({
    date: split.date,
    gamePk: split.game?.gamePk,
    opponentId: split.opponent?.id,
    opponentName: split.opponent?.name,
    isHome: Boolean(split.isHome),
    isWin: split.isWin,
    summary: split.stat?.summary,
    stat: split.stat as StatLine,
  }));

  return { season, seasonTeams, months, gameLog };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Situational splits by MLB "sitCode": "vl"/"vr" (vs. left/right) and
// "h"/"a" (home/away).
export async function getPlayerSituationSplits(
  playerId: number,
  year: number,
  group: StatGroup,
  codes: string[]
): Promise<SituationSplit[]> {
  const data = await fetchJson<RawStatsResponse>(
    `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=statSplits&group=${group}&season=${year}&sitCodes=${codes.join(",")}`,
    3600
  );

  const block = data?.stats?.find((entry) => entry.type.displayName === "statSplits");
  const splits = block?.splits ?? [];

  // A player who changed teams mid-season gets one split per team stint
  // *plus* a season-combined split with no `team` attached, all sharing the
  // same split code — keep only the combined one per code (falling
  // back to the single per-team entry when a player stayed on one team).
  const byCode = new Map<string, Record<string, any>>();

  for (const split of splits) {
    const code = split.split?.code;

    if (!code) {
      continue;
    }

    const isAggregate = !split.team;
    const existing = byCode.get(code);
    const existingIsAggregate = existing ? !existing.team : false;

    if (!existing || (isAggregate && !existingIsAggregate)) {
      byCode.set(code, split);
    }
  }

  return Array.from(byCode.values()).map((split) => ({
    code: split.split?.code,
    description: split.split?.description,
    stat: split.stat as StatLine,
  }));
}

export function computeIso(slg: number, avg: number): number {
  return slg - avg;
}

export function computeBbPercent(baseOnBalls: number, denominator: number): number | null {
  if (!denominator) {
    return null;
  }

  return (baseOnBalls / denominator) * 100;
}

export function computeKPercent(strikeOuts: number, denominator: number): number | null {
  if (!denominator) {
    return null;
  }

  return (strikeOuts / denominator) * 100;
}

export function computeXbh(doubles: number, triples: number, homeRuns: number): number {
  return doubles + triples + homeRuns;
}

export function inningsToOuts(innings: string | undefined): number {
  if (!innings) {
    return 0;
  }

  const [whole, fraction = "0"] = innings.split(".");
  const wholePart = Number(whole) * 3;
  const fractionalPart = fraction === "1" ? 1 : fraction === "2" ? 2 : 0;

  return wholePart + fractionalPart;
}

export function parseStatNumber(value: string | number | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeAgeAsOf(birthDate: string | undefined, referenceDate: string): number | null {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(`${birthDate}T00:00:00Z`);
  const reference = new Date(`${referenceDate}T00:00:00Z`);

  let age = reference.getUTCFullYear() - birth.getUTCFullYear();

  const hasHadBirthdayThisYear =
    reference.getUTCMonth() > birth.getUTCMonth() ||
    (reference.getUTCMonth() === birth.getUTCMonth() &&
      reference.getUTCDate() >= birth.getUTCDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

export function formatRate(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const fixed = value.toFixed(3);

  return value < 1 ? fixed.replace(/^0/, "") : fixed;
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${value.toFixed(1)}%`;
}

// No OPS+/ERA+ here — a real park-factor adjustment isn't available at
// every granularity these columns are used at (season, month, handedness
// split, rolling window), and showing a non-park-adjusted number under
// that name would misrepresent it. Season lines get park-adjusted wRC+ /
// ERA+ separately, from lib/park-adjusted.ts.
export const HITTER_COLUMNS = [
  "G",
  "PA",
  "AVG",
  "OBP",
  "SLG",
  "OPS",
  "HR",
  "XBH",
  "RBI",
  "SB",
  "ISO",
  "BB%",
  "K%",
] as const;

export const PITCHER_COLUMNS = [
  "G",
  "GS",
  "W-L",
  "SV",
  "IP",
  "ERA",
  "WHIP",
  "K",
  "BB",
  "K%",
  "BB%",
  "K-BB%",
  "HR/9",
] as const;

// Handedness splits: games played isn't meaningful for a hitter's split,
// and for pitchers the opponent slash line replaces the role/run-based
// columns (GS, W-L, SV, ERA, WHIP), which don't split by batter hand.
export const HITTER_HANDEDNESS_COLUMNS = HITTER_COLUMNS.filter((column) => column !== "G");

export const PITCHER_HANDEDNESS_COLUMNS = [
  "G",
  "IP",
  "AVG",
  "OBP",
  "SLG",
  "OPS",
  "K",
  "BB",
  "K%",
  "BB%",
  "K-BB%",
  "HR/9",
] as const;

export type HitterColumn = (typeof HITTER_COLUMNS)[number];
export type PitcherColumn = (typeof PITCHER_COLUMNS)[number];
export type StatRow = Record<string, string>;

export function buildHitterRow(stat: StatLine | null): StatRow {
  if (!stat) {
    return Object.fromEntries(HITTER_COLUMNS.map((column) => [column, "-"]));
  }

  const avg = parseStatNumber(stat.avg);
  const slg = parseStatNumber(stat.slg);
  const pa = stat.plateAppearances ?? 0;
  const bb = stat.baseOnBalls ?? 0;
  const k = stat.strikeOuts ?? 0;

  return {
    G: String(stat.gamesPlayed ?? 0),
    PA: String(pa),
    AVG: stat.avg ?? "-",
    OBP: stat.obp ?? "-",
    SLG: stat.slg ?? "-",
    OPS: stat.ops ?? "-",
    HR: String(stat.homeRuns ?? 0),
    XBH: String(computeXbh(stat.doubles ?? 0, stat.triples ?? 0, stat.homeRuns ?? 0)),
    RBI: String(stat.rbi ?? 0),
    SB: String(stat.stolenBases ?? 0),
    ISO: formatRate(computeIso(slg, avg)),
    "BB%": formatPercent(computeBbPercent(bb, pa)),
    "K%": formatPercent(computeKPercent(k, pa)),
  };
}

export function buildPitcherRow(stat: StatLine | null): StatRow {
  if (!stat) {
    return Object.fromEntries(PITCHER_COLUMNS.map((column) => [column, "-"]));
  }

  const bf = stat.battersFaced ?? 0;
  const bb = stat.baseOnBalls ?? 0;
  const k = stat.strikeOuts ?? 0;
  const kPercent = computeKPercent(k, bf);
  const bbPercent = computeBbPercent(bb, bf);

  return {
    G: String(stat.gamesPitched ?? 0),
    GS: String(stat.gamesStarted ?? 0),
    "W-L": `${stat.wins ?? 0}-${stat.losses ?? 0}`,
    SV: String(stat.saves ?? 0),
    IP: stat.inningsPitched ?? "-",
    // Opponents' slash line, used by the handedness splits.
    AVG: stat.avg ?? "-",
    OBP: stat.obp ?? "-",
    SLG: stat.slg ?? "-",
    OPS: stat.ops ?? "-",
    ERA: stat.era ?? "-",
    WHIP: stat.whip ?? "-",
    K: String(k),
    BB: String(bb),
    "K%": formatPercent(kPercent),
    "BB%": formatPercent(bbPercent),
    "K-BB%":
      kPercent === null || bbPercent === null ? "-" : formatPercent(kPercent - bbPercent),
    "HR/9": stat.homeRunsPer9 ?? "-",
  };
}

export function buildStatRow(role: PlayerRole, stat: StatLine | null): StatRow {
  return role === "Pitcher" ? buildPitcherRow(stat) : buildHitterRow(stat);
}

// Only columns with a real MLB Stats API leaderboard category are ranked —
// derived/advanced columns like OPS+, ISO, K%, or the compound W-L don't
// have one. Rate categories (AVG, ERA, WHIP, etc.) are already restricted
// to qualified players by the API itself, matching how MLB's own site
// defines qualification.
const HITTER_RANK_CATEGORIES: Partial<Record<HitterColumn, string>> = {
  G: "gamesPlayed",
  PA: "totalPlateAppearances",
  AVG: "battingAverage",
  OBP: "onBasePercentage",
  SLG: "sluggingPercentage",
  OPS: "onBasePlusSlugging",
  HR: "homeRuns",
  XBH: "extraBaseHits",
  RBI: "runsBattedIn",
  SB: "stolenBases",
};

const PITCHER_RANK_CATEGORIES: Partial<Record<PitcherColumn, string>> = {
  G: "gamesPlayed",
  GS: "gamesStarted",
  SV: "saves",
  IP: "inningsPitched",
  ERA: "earnedRunAverage",
  WHIP: "walksAndHitsPerInningPitched",
  K: "strikeouts",
  BB: "walks",
};

async function fetchCategoryRank(
  category: string,
  playerId: number,
  year: number,
  group: "hitting" | "pitching",
  leagueId?: number
): Promise<number | null> {
  const leagueParam = leagueId ? `&leagueId=${leagueId}` : "";

  const data = await fetchJson<{
    leagueLeaders?: Array<{ leaders?: Array<{ rank: number; person: { id: number } }> }>;
  }>(
    `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${category}&season=${year}&sportId=1${leagueParam}&statGroup=${group}&limit=50`,
    21_600
  );

  const leaders = data?.leagueLeaders?.[0]?.leaders ?? [];
  const entry = leaders.find((leader) => leader.person.id === playerId);

  return entry?.rank ?? null;
}

// A player's rank (top 50 only) for each season-stat column that has a
// matching leaderboard category. Pass a leagueId to rank within just the AL
// or NL (104=NL, 103=AL); omit it entirely for a combined MLB-wide rank,
// which is what a player traded across leagues mid-season should get since
// neither league's own leaderboard reflects their full-season line.
export async function getColumnRanks(
  playerId: number,
  year: number,
  role: PlayerRole,
  leagueId?: number
): Promise<Record<string, number>> {
  const group = role === "Pitcher" ? "pitching" : "hitting";
  const categories = role === "Pitcher" ? PITCHER_RANK_CATEGORIES : HITTER_RANK_CATEGORIES;

  const entries = await Promise.all(
    Object.entries(categories).map(async ([column, category]) => {
      const rank = category ? await fetchCategoryRank(category, playerId, year, group, leagueId) : null;
      return [column, rank] as const;
    })
  );

  return Object.fromEntries(
    entries.filter((entry): entry is [string, number] => entry[1] !== null)
  );
}

function sumWindow(games: GameLogEntry[], pick: (stat: StatLine) => number | undefined) {
  return games.reduce((total, game) => total + (pick(game.stat) ?? 0), 0);
}

// Every numeric stat summed across a stretch of games, for calculations
// that need the whole line at once (e.g. rolling wRC+ / ERA+).
export function sumGameLogStats(games: GameLogEntry[]): StatLine {
  const totals: Record<string, number> = {};

  for (const game of games) {
    for (const [key, value] of Object.entries(game.stat)) {
      if (typeof value === "number") {
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }

  return totals as StatLine;
}

export function computeRollingValue(
  window: GameLogEntry[],
  statKey: string,
  role: PlayerRole
): number | null {
  if (window.length === 0) {
    return null;
  }

  if (role === "Hitter") {
    const pa = sumWindow(window, (s) => s.plateAppearances);
    const ab = sumWindow(window, (s) => s.atBats);
    const hits = sumWindow(window, (s) => s.hits);
    const bb = sumWindow(window, (s) => s.baseOnBalls);
    const hbp = sumWindow(window, (s) => s.hitByPitch);
    const sf = sumWindow(window, (s) => s.sacFlies);
    const totalBases = sumWindow(window, (s) => s.totalBases);
    const avg = ab > 0 ? hits / ab : 0;
    const obpDenominator = ab + bb + hbp + sf;
    const obp = obpDenominator > 0 ? (hits + bb + hbp) / obpDenominator : 0;
    const slg = ab > 0 ? totalBases / ab : 0;
    const k = sumWindow(window, (s) => s.strikeOuts);

    switch (statKey) {
      case "G":
        return window.length;
      case "PA":
        return pa;
      case "AVG":
        return avg;
      case "OBP":
        return obp;
      case "SLG":
        return slg;
      case "OPS":
        return obp + slg;
      case "HR":
        return sumWindow(window, (s) => s.homeRuns);
      case "XBH":
        return (
          sumWindow(window, (s) => s.doubles) +
          sumWindow(window, (s) => s.triples) +
          sumWindow(window, (s) => s.homeRuns)
        );
      case "RBI":
        return sumWindow(window, (s) => s.rbi);
      case "SB":
        return sumWindow(window, (s) => s.stolenBases);
      case "ISO":
        return slg - avg;
      case "BB%":
        return computeBbPercent(bb, pa);
      case "K%":
        return computeKPercent(k, pa);
      default:
        return null;
    }
  }

  const outs = sumWindow(window, (s) => s.outs);
  const earnedRuns = sumWindow(window, (s) => s.earnedRuns);
  const bf = sumWindow(window, (s) => s.battersFaced);
  const ab = sumWindow(window, (s) => s.atBats);
  const hits = sumWindow(window, (s) => s.hits);
  const bb = sumWindow(window, (s) => s.baseOnBalls);
  const hbp = sumWindow(window, (s) => s.hitByPitch);
  const sf = sumWindow(window, (s) => s.sacFlies);
  const totalBases = sumWindow(window, (s) => s.totalBases);
  const homeRuns = sumWindow(window, (s) => s.homeRuns);
  const k = sumWindow(window, (s) => s.strikeOuts);
  const era = outs > 0 ? (earnedRuns * 27) / outs : 0;
  const whip = outs > 0 ? (bb + hits) / (outs / 3) : 0;
  const avg = ab > 0 ? hits / ab : 0;
  const obpDenominator = ab + bb + hbp + sf;
  const obp = obpDenominator > 0 ? (hits + bb + hbp) / obpDenominator : 0;
  const slg = ab > 0 ? totalBases / ab : 0;
  const kPercent = computeKPercent(k, bf);
  const bbPercent = computeBbPercent(bb, bf);

  switch (statKey) {
    case "G":
      return window.length;
    case "GS":
      return sumWindow(window, (s) => s.gamesStarted);
    case "IP":
      return outs / 3;
    case "ERA":
      return era;
    case "WHIP":
      return whip;
    case "K":
      return k;
    case "BB":
      return bb;
    case "K%":
      return kPercent;
    case "BB%":
      return bbPercent;
    case "K-BB%":
      return kPercent === null || bbPercent === null ? null : kPercent - bbPercent;
    case "HR/9":
      return outs > 0 ? (homeRuns * 27) / outs : 0;
    case "AVG":
      return avg;
    case "OBP":
      return obp;
    case "SLG":
      return slg;
    case "OPS":
      return obp + slg;
    default:
      return null;
  }
}

export function formatRollingValue(statKey: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (statKey.endsWith("%")) {
    return `${value.toFixed(1)}%`;
  }

  if (["G", "GS", "HR", "XBH", "RBI", "SB", "K", "BB", "PA", "wRC+", "ERA+"].includes(statKey)) {
    return String(Math.round(value));
  }

  if (statKey === "IP") {
    return value.toFixed(1);
  }

  if (statKey === "ERA" || statKey === "WHIP" || statKey === "HR/9") {
    return value.toFixed(2);
  }

  return formatRate(value);
}

export const NL_LEAGUE_ID = 104;
export const AL_LEAGUE_ID = 103;
const NL_CENTRAL_DIVISION_ID = 205;

export type TeamStanding = {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  winningPercentage: string;
  gamesBack: string;
  streak?: string;
  rank?: string;
};

type RawTeamRecord = {
  team: { id: number; name: string };
  wins: number;
  losses: number;
  winningPercentage: string;
  gamesBack: string;
  wildCardGamesBack?: string;
  divisionRank?: string;
  wildCardRank?: string;
  streak?: { streakCode?: string };
};

export async function getDivisionStandings(season: number): Promise<TeamStanding[]> {
  const data = await fetchJson<{
    records?: Array<{
      division: { id: number };
      teamRecords: RawTeamRecord[];
    }>;
  }>(
    `https://statsapi.mlb.com/api/v1/standings?leagueId=${NL_LEAGUE_ID}&season=${season}&standingsTypes=regularSeason`,
    3600
  );

  const group = data?.records?.find(
    (record) => record.division.id === NL_CENTRAL_DIVISION_ID
  );

  return (group?.teamRecords ?? [])
    .map((entry) => ({
      teamId: entry.team.id,
      teamName: entry.team.name,
      wins: entry.wins,
      losses: entry.losses,
      winningPercentage: entry.winningPercentage,
      gamesBack: entry.gamesBack,
      streak: entry.streak?.streakCode,
      rank: entry.divisionRank,
    }))
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

export async function getWildCardStandings(season: number): Promise<TeamStanding[]> {
  const data = await fetchJson<{
    records?: Array<{
      teamRecords: RawTeamRecord[];
    }>;
  }>(
    `https://statsapi.mlb.com/api/v1/standings?leagueId=${NL_LEAGUE_ID}&season=${season}&standingsTypes=wildCard`,
    3600
  );

  const group = data?.records?.[0];

  return (group?.teamRecords ?? [])
    .map((entry) => ({
      teamId: entry.team.id,
      teamName: entry.team.name,
      wins: entry.wins,
      losses: entry.losses,
      winningPercentage: entry.winningPercentage,
      gamesBack: entry.wildCardGamesBack ?? entry.gamesBack,
      streak: entry.streak?.streakCode,
      rank: entry.wildCardRank,
    }))
    .sort((a, b) => Number(a.rank) - Number(b.rank));
}

// How a player was used in one MLB season: games at each fielding position
// (DH included) and, for pitchers, starts, relief outings, saves and holds.
// The GM Simulator ranks players for an open roster spot by this.
// Basic details for players by id, in RosterEntry shape (for players a
// club pays who aren't in its roster feed).
export async function getPlayersById(playerIds: number[]): Promise<RosterEntry[]> {
  if (playerIds.length === 0) {
    return [];
  }
  const data = await fetchJson<{
    people?: Array<{
      id: number;
      fullName: string;
      useLastName?: string;
      mlbDebutDate?: string;
      batSide?: { code?: string };
      pitchHand?: { code?: string };
      primaryPosition?: { abbreviation?: string };
    }>;
  }>(`https://statsapi.mlb.com/api/v1/people?personIds=${playerIds.join(",")}`, 21_600);

  return (data?.people ?? []).map((person) => ({
    id: person.id,
    fullName: person.fullName,
    lastName: person.useLastName,
    position: person.primaryPosition?.abbreviation ?? "",
    debutDate: person.mlbDebutDate,
    bats: person.batSide?.code,
    throws: person.pitchHand?.code,
  }));
}

export type PositionUsage = {
  games: Record<string, number>;
  starts: number;
  relief: number;
  saves: number;
  holds: number;
};

type UsageStatsPerson = {
  id: number;
  stats?: Array<{
    group?: { displayName?: string };
    splits?: Array<{
      team?: { id?: number };
      position?: { abbreviation?: string };
      stat?: { gamesPlayed?: number; gamesStarted?: number; saves?: number; holds?: number };
    }>;
  }>;
};

export async function getPositionUsage(playerIds: number[], season: number): Promise<Record<number, PositionUsage>> {
  const usage: Record<number, PositionUsage> = {};
  const ids = [...new Set(playerIds.filter((id) => id > 0))];

  // The people endpoint takes a list of ids; keep URLs a reasonable length.
  const batches: number[][] = [];
  for (let index = 0; index < ids.length; index += 50) {
    batches.push(ids.slice(index, index + 50));
  }

  const responses = await Promise.all(
    batches.map((batch) =>
      fetchJson<{ people?: UsageStatsPerson[] }>(
        `https://statsapi.mlb.com/api/v1/people?personIds=${batch.join(",")}&hydrate=stats(group=[fielding,pitching],type=[season],season=${season})`,
        21_600
      )
    )
  );

  for (const person of responses.flatMap((response) => response?.people ?? [])) {
    const entry: PositionUsage = { games: {}, starts: 0, relief: 0, saves: 0, holds: 0 };

    for (const block of person.stats ?? []) {
      const splits = block.splits ?? [];
      // A traded player gets one split per team (and sometimes a combined
      // one without a team) — count per-team splits so nothing doubles.
      const counted = splits.some((split) => split.team?.id) ? splits.filter((split) => split.team?.id) : splits;

      for (const split of counted) {
        const stat = split.stat ?? {};
        if (block.group?.displayName === "fielding") {
          const position = split.position?.abbreviation;
          if (position && position !== "P") {
            entry.games[position] = (entry.games[position] ?? 0) + (stat.gamesPlayed ?? 0);
          }
        } else if (block.group?.displayName === "pitching") {
          entry.starts += stat.gamesStarted ?? 0;
          entry.relief += (stat.gamesPlayed ?? 0) - (stat.gamesStarted ?? 0);
          entry.saves += stat.saves ?? 0;
          entry.holds += stat.holds ?? 0;
        }
      }
    }

    usage[person.id] = entry;
  }

  return usage;
}

// Major MLB honors, keyed by the Stats API's award id. AL and NL versions
// share a label so they combine. Weekly/monthly, team, minor league awards
// and runner-up finishes aren't listed, so they're left out.
const MAJOR_AWARDS: Record<string, string> = {
  ALMVP: "MVP",
  NLMVP: "MVP",
  ALCY: "Cy Young",
  NLCY: "Cy Young",
  ALROY: "Rookie of the Year",
  NLROY: "Rookie of the Year",
  WSCHAMP: "World Series Champion",
  WSMVP: "World Series MVP",
  ALCSMVP: "ALCS MVP",
  NLCSMVP: "NLCS MVP",
  ALAS: "All-Star",
  NLAS: "All-Star",
  ASMVP: "All-Star Game MVP",
  HRDERBYWIN: "Home Run Derby Champion",
  ALSS: "Silver Slugger",
  NLSS: "Silver Slugger",
  ALGG: "Gold Glove",
  NLGG: "Gold Glove",
  ALPG: "Platinum Glove",
  NLPG: "Platinum Glove",
  ALHAA: "Hank Aaron Award",
  NLHAA: "Hank Aaron Award",
  ALCPOY: "Comeback Player of the Year",
  NLCPOY: "Comeback Player of the Year",
  ALREL: "Reliever of the Year",
  NLREL: "Reliever of the Year",
  DHOY: "Outstanding DH",
  MLBAFIRST: "All-MLB First Team",
  MLBSECOND: "All-MLB Second Team",
  MLBRC: "Roberto Clemente Award",
  MLBPCPOY: "Players Choice Player of the Year",
  WBCMVP: "World Baseball Classic MVP",
};

// Display order: the biggest honors first.
const AWARD_ORDER = [...new Set(Object.values(MAJOR_AWARDS))];

export type PlayerAward = { label: string; seasons: number[] };

export async function getPlayerAwards(playerId: number): Promise<PlayerAward[]> {
  const data = await fetchJson<{ awards?: Array<{ id?: string; season?: string }> }>(
    `https://statsapi.mlb.com/api/v1/people/${playerId}/awards`,
    86_400
  );

  const seasonsByLabel = new Map<string, Set<number>>();
  for (const award of data?.awards ?? []) {
    const label = award.id ? MAJOR_AWARDS[award.id] : undefined;
    const season = Number(award.season);
    if (!label || !Number.isInteger(season)) {
      continue;
    }
    seasonsByLabel.set(label, (seasonsByLabel.get(label) ?? new Set()).add(season));
  }

  return [...seasonsByLabel.entries()]
    .map(([label, seasons]) => ({ label, seasons: [...seasons].sort((a, b) => a - b) }))
    .sort((a, b) => AWARD_ORDER.indexOf(a.label) - AWARD_ORDER.indexOf(b.label));
}

// "2015–19, 2021–23": consecutive seasons collapse into ranges.
export function formatAwardSeasons(seasons: number[]): string {
  const ranges: string[] = [];
  let start = seasons[0];
  for (let index = 1; index <= seasons.length; index += 1) {
    const previous = seasons[index - 1];
    if (seasons[index] !== previous + 1) {
      ranges.push(start === previous ? String(start) : `${start}–${String(previous).slice(2)}`);
      start = seasons[index];
    }
  }
  return ranges.join(", ");
}
