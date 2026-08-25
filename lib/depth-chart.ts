import { getCardinalsRoster, type RosterEntry } from "@/lib/mlb";

const POSITION_ORDER = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

// A pitcher whose starts make up more than this share of their appearances
// is grouped as a starter; everyone else (including swingmen who've mostly
// relieved) goes to the bullpen.
const STARTER_RATIO_THRESHOLD = 0.4;

// Recency weighting for depth order: a game's contribution to a player's
// score halves every this many days, so someone who's been playing the
// position lately outranks someone with more total games but who hasn't
// played there in weeks.
const RECENCY_HALF_LIFE_DAYS = 21;

const NAME_SUFFIXES = new Set(["Jr.", "Jr", "Sr.", "Sr", "II", "III", "IV", "V"]);

function getLastName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  let lastIndex = parts.length - 1;

  while (lastIndex > 0 && NAME_SUFFIXES.has(parts[lastIndex])) {
    lastIndex -= 1;
  }

  return parts[lastIndex] ?? fullName;
}

export type DepthChartPlayer = {
  id: number;
  fullName: string;
  status?: string;
};

export type DepthChartGroup = {
  position: string;
  players: DepthChartPlayer[];
};

export type DepthChart = {
  positionGroups: DepthChartGroup[];
  starters: DepthChartPlayer[];
  bullpen: DepthChartPlayer[];
};

type GameLogSplit = {
  date?: string;
  position?: { abbreviation?: string };
  stat?: { gamesStarted?: number };
};

async function getPositionGameLog(playerId: number, year: number): Promise<GameLogSplit[]> {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=fielding&season=${year}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      return [];
    }

    const data: { stats?: Array<{ splits?: GameLogSplit[] }> } = await response.json();

    return data.stats?.[0]?.splits ?? [];
  } catch (error) {
    console.error("getPositionGameLog failed", playerId, error);
    return [];
  }
}

function recencyWeight(dateStr: string | undefined, today: Date): number {
  if (!dateStr) {
    return 0;
  }

  const days = (today.getTime() - new Date(`${dateStr}T12:00:00Z`).getTime()) / 86_400_000;

  if (!Number.isFinite(days) || days < 0) {
    return 1;
  }

  return 2 ** (-days / RECENCY_HALF_LIFE_DAYS);
}

type ScoredPlayer = DepthChartPlayer & { score: number };

function sortByScore(entries: ScoredPlayer[]): DepthChartPlayer[] {
  return entries
    .slice()
    .sort(
      (a, b) => b.score - a.score || getLastName(a.fullName).localeCompare(getLastName(b.fullName))
    )
    .map((entry) => ({ id: entry.id, fullName: entry.fullName, status: entry.status }));
}

// Ranks players at each position by a recency-weighted score instead of
// raw season games, so someone playing the position lately outranks
// someone with more total games but who hasn't played there in weeks. A
// super-utility player can (correctly) show up under several positions at
// once. Pitchers are only ever classified as Starters/Bullpen based on
// their own pitching appearances — a position player's emergency mop-up
// inning doesn't put them on the pitching staff.
export async function getDepthChart(year: number): Promise<DepthChart> {
  const roster = await getCardinalsRoster(year, "40Man");
  const today = new Date();

  const perPlayerLogs = await Promise.all(
    roster.map(async (player) => ({
      player,
      games: await getPositionGameLog(player.id, year),
    }))
  );

  const byPosition = new Map<string, Map<number, ScoredPlayer>>();
  const pitchers = new Map<number, { player: RosterEntry; starts: number; total: number; score: number }>();

  function addToPosition(position: string, player: RosterEntry, weight: number) {
    let posMap = byPosition.get(position);

    if (!posMap) {
      posMap = new Map();
      byPosition.set(position, posMap);
    }

    const existing = posMap.get(player.id);

    if (existing) {
      existing.score += weight;
    } else {
      posMap.set(player.id, { id: player.id, fullName: player.fullName, status: player.status, score: weight });
    }
  }

  for (const { player, games } of perPlayerLogs) {
    if (games.length === 0) {
      // No appearances logged yet this season (hurt all year, hasn't
      // debuted, etc.) — still show them at their roster position/staff so
      // they don't just vanish, with no ranking weight.
      if (player.position === "P") {
        pitchers.set(player.id, { player, starts: 0, total: 0, score: 0 });
      } else {
        addToPosition(player.position, player, 0);
      }

      continue;
    }

    for (const game of games) {
      const abbreviation = game.position?.abbreviation;

      if (!abbreviation) {
        continue;
      }

      const weight = recencyWeight(game.date, today);

      if (abbreviation === "P") {
        // Only true pitchers count toward the pitching staff — a position
        // player's emergency inning shouldn't land them in the bullpen.
        if (player.position !== "P") {
          continue;
        }

        const bucket = pitchers.get(player.id) ?? { player, starts: 0, total: 0, score: 0 };
        bucket.total += 1;
        if ((game.stat?.gamesStarted ?? 0) > 0) {
          bucket.starts += 1;
        }
        bucket.score += weight;
        pitchers.set(player.id, bucket);
        continue;
      }

      addToPosition(abbreviation, player, weight);
    }
  }

  const positionGroups: DepthChartGroup[] = POSITION_ORDER.map((position) => ({
    position,
    players: sortByScore(Array.from(byPosition.get(position)?.values() ?? [])),
  })).filter((group) => group.players.length > 0);

  const knownPositions = new Set(POSITION_ORDER);

  for (const [position, players] of byPosition) {
    if (!knownPositions.has(position)) {
      positionGroups.push({ position, players: sortByScore(Array.from(players.values())) });
    }
  }

  const starterEntries: ScoredPlayer[] = [];
  const bullpenEntries: ScoredPlayer[] = [];

  for (const { player, starts, total, score } of pitchers.values()) {
    const isStarter = total > 0 && starts / total > STARTER_RATIO_THRESHOLD;
    const entry: ScoredPlayer = { id: player.id, fullName: player.fullName, status: player.status, score };
    (isStarter ? starterEntries : bullpenEntries).push(entry);
  }

  return {
    positionGroups,
    starters: sortByScore(starterEntries),
    bullpen: sortByScore(bullpenEntries),
  };
}
