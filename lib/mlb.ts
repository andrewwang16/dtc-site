export const CARDINALS_TEAM_ID = 138;

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
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  rbi?: number;
  stolenBases?: number;
  baseOnBalls?: number;
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
  homeRunsPer9?: string;
  earnedRuns?: number;
  outs?: number;
};

export type MonthSplit = {
  month: string;
  stat: StatLine;
};

export type HandednessSplit = {
  code: "vl" | "vr";
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

export type LeagueAverages = {
  lgObp: number;
  lgSlg: number;
  lgEra: number;
};

export type RosterEntry = {
  id: number;
  fullName: string;
  position: string;
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

export async function getCardinalsRoster(
  year: number,
  rosterType: RosterType = "fullSeason"
): Promise<RosterEntry[]> {
  const data = await fetchJson<{
    roster?: Array<{
      person: { id: number; fullName: string };
      position: { abbreviation: string };
      jerseyNumber?: string;
      status?: { description?: string };
    }>;
  }>(
    `https://statsapi.mlb.com/api/v1/teams/${CARDINALS_TEAM_ID}/roster?rosterType=${rosterType}&season=${year}`,
    3600
  );

  return (data?.roster ?? []).map((entry) => ({
    id: entry.person.id,
    fullName: entry.person.fullName,
    position: entry.position.abbreviation,
    jerseyNumber: entry.jerseyNumber,
    status: entry.status?.description,
  }));
}

export type ExternalPlayer = {
  id: number;
  fullName: string;
  position: string;
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
      primaryPosition?: { abbreviation?: string };
      currentTeam?: { id?: number };
    }>;
  }>(`https://statsapi.mlb.com/api/v1/sports/1/players?season=${year}`, 21_600);

  return (data?.people ?? []).map((person) => ({
    id: person.id,
    fullName: person.fullName,
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

export async function getPlayerHandednessSplits(
  playerId: number,
  year: number,
  group: StatGroup
): Promise<HandednessSplit[]> {
  const data = await fetchJson<RawStatsResponse>(
    `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=statSplits&group=${group}&season=${year}&sitCodes=vl,vr`,
    3600
  );

  const block = data?.stats?.find((entry) => entry.type.displayName === "statSplits");
  const splits = block?.splits ?? [];

  // A player who changed teams mid-season gets one split per team stint
  // *plus* a season-combined split with no `team` attached, all sharing the
  // same handedness code — keep only the combined one per code (falling
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

export async function getLeagueAverages(year: number): Promise<LeagueAverages> {
  const [hitting, pitching] = await Promise.all([
    fetchJson<{ stats?: Array<{ splits?: Array<{ stat: Record<string, any> }> }> }>(
      `https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=hitting&season=${year}&sportId=1&gameType=R`,
      21600
    ),
    fetchJson<{ stats?: Array<{ splits?: Array<{ stat: Record<string, any> }> }> }>(
      `https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=pitching&season=${year}&sportId=1&gameType=R`,
      21600
    ),
  ]);

  const hittingSplits = hitting?.stats?.[0]?.splits ?? [];
  const pitchingSplits = pitching?.stats?.[0]?.splits ?? [];

  let hits = 0;
  let baseOnBalls = 0;
  let hitByPitch = 0;
  let atBats = 0;
  let sacFlies = 0;
  let totalBases = 0;

  for (const split of hittingSplits) {
    hits += split.stat.hits ?? 0;
    baseOnBalls += split.stat.baseOnBalls ?? 0;
    hitByPitch += split.stat.hitByPitch ?? 0;
    atBats += split.stat.atBats ?? 0;
    sacFlies += split.stat.sacFlies ?? 0;
    totalBases += split.stat.totalBases ?? 0;
  }

  const obpDenominator = atBats + baseOnBalls + hitByPitch + sacFlies;
  const lgObp = obpDenominator > 0 ? (hits + baseOnBalls + hitByPitch) / obpDenominator : 0;
  const lgSlg = atBats > 0 ? totalBases / atBats : 0;

  let earnedRuns = 0;
  let outs = 0;

  for (const split of pitchingSplits) {
    earnedRuns += split.stat.earnedRuns ?? 0;
    outs += split.stat.outs ?? 0;
  }

  const lgEra = outs > 0 ? (earnedRuns * 27) / outs : 0;

  return { lgObp, lgSlg, lgEra };
}

export function computeOpsPlus(
  obp: number,
  slg: number,
  lgObp: number,
  lgSlg: number
): number | null {
  if (!lgObp || !lgSlg) {
    return null;
  }

  return Math.round(100 * (obp / lgObp + slg / lgSlg - 1));
}

export function computeEraPlus(era: number, lgEra: number): number | null {
  if (!era || !lgEra) {
    return null;
  }

  return Math.round((100 * lgEra) / era);
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

export function formatPlus(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return String(value);
}

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
  "OPS+",
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
  "AVG",
  "OBP",
  "SLG",
  "OPS",
  "ERA+",
  "OPS+",
] as const;

export type HitterColumn = (typeof HITTER_COLUMNS)[number];
export type PitcherColumn = (typeof PITCHER_COLUMNS)[number];
export type StatRow = Record<string, string>;

export function buildHitterRow(stat: StatLine | null, league: LeagueAverages): StatRow {
  if (!stat) {
    return Object.fromEntries(HITTER_COLUMNS.map((column) => [column, "-"]));
  }

  const avg = parseStatNumber(stat.avg);
  const obp = parseStatNumber(stat.obp);
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
    "OPS+": formatPlus(computeOpsPlus(obp, slg, league.lgObp, league.lgSlg)),
  };
}

export function buildPitcherRow(stat: StatLine | null, league: LeagueAverages): StatRow {
  if (!stat) {
    return Object.fromEntries(PITCHER_COLUMNS.map((column) => [column, "-"]));
  }

  const era = parseStatNumber(stat.era);
  const obp = parseStatNumber(stat.obp);
  const slg = parseStatNumber(stat.slg);
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
    ERA: stat.era ?? "-",
    WHIP: stat.whip ?? "-",
    K: String(k),
    BB: String(bb),
    "K%": formatPercent(kPercent),
    "BB%": formatPercent(bbPercent),
    "K-BB%":
      kPercent === null || bbPercent === null ? "-" : formatPercent(kPercent - bbPercent),
    "HR/9": stat.homeRunsPer9 ?? "-",
    AVG: stat.avg ?? "-",
    OBP: stat.obp ?? "-",
    SLG: stat.slg ?? "-",
    OPS: stat.ops ?? "-",
    "ERA+": formatPlus(computeEraPlus(era, league.lgEra)),
    "OPS+": formatPlus(computeOpsPlus(obp, slg, league.lgObp, league.lgSlg)),
  };
}

export function buildStatRow(
  role: PlayerRole,
  stat: StatLine | null,
  league: LeagueAverages
): StatRow {
  return role === "Pitcher" ? buildPitcherRow(stat, league) : buildHitterRow(stat, league);
}

function sumWindow(games: GameLogEntry[], pick: (stat: StatLine) => number | undefined) {
  return games.reduce((total, game) => total + (pick(game.stat) ?? 0), 0);
}

export function computeRollingValue(
  window: GameLogEntry[],
  statKey: string,
  role: PlayerRole,
  league: LeagueAverages
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
      case "OPS+":
        return computeOpsPlus(obp, slg, league.lgObp, league.lgSlg);
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
    case "ERA+":
      return computeEraPlus(era, league.lgEra);
    case "OPS+":
      return computeOpsPlus(obp, slg, league.lgObp, league.lgSlg);
    default:
      return null;
  }
}

export function formatRollingValue(statKey: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (statKey === "OPS+" || statKey === "ERA+") {
    return String(Math.round(value));
  }

  if (statKey.endsWith("%")) {
    return `${value.toFixed(1)}%`;
  }

  if (["G", "GS", "HR", "XBH", "RBI", "SB", "K", "BB", "PA"].includes(statKey)) {
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

const NL_LEAGUE_ID = 104;
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
