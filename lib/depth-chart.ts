import { getCardinalsRoster } from "@/lib/mlb";

const POSITION_ORDER = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

// A pitcher whose starts make up more than this share of their appearances
// is grouped as a starter; everyone else (including swingmen who've mostly
// relieved) goes to the bullpen.
const STARTER_RATIO_THRESHOLD = 0.4;

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
  gamesAtPosition: number;
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

type FieldingSplit = {
  team?: { id?: number };
  stat?: {
    gamesPlayed?: number;
    gamesStarted?: number;
    position?: { abbreviation?: string };
  };
};

// A player traded mid-season gets one split per team stint *plus* a
// combined split with no `team` attached — same shape as season hitting/
// pitching stats elsewhere in this app. Keep only the combined split per
// position (or the lone team split, for anyone who stayed put all year),
// or a traded player's games get triple-counted and misattributed.
async function getPositionSplits(playerId: number, year: number): Promise<FieldingSplit[]> {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&group=fielding&season=${year}`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      return [];
    }

    const data: { stats?: Array<{ splits?: FieldingSplit[] }> } = await response.json();
    const rawSplits = data.stats?.[0]?.splits ?? [];

    const byPosition = new Map<string, FieldingSplit>();

    for (const split of rawSplits) {
      const position = split.stat?.position?.abbreviation;

      if (!position) {
        continue;
      }

      const existing = byPosition.get(position);

      if (!existing || (existing.team && !split.team)) {
        byPosition.set(position, split);
      }
    }

    return Array.from(byPosition.values());
  } catch (error) {
    console.error("getPositionSplits failed", playerId, error);
    return [];
  }
}

function sortEntries(entries: DepthChartPlayer[]) {
  return entries.slice().sort((a, b) => {
    if (b.gamesAtPosition !== a.gamesAtPosition) {
      return b.gamesAtPosition - a.gamesAtPosition;
    }

    return getLastName(a.fullName).localeCompare(getLastName(b.fullName));
  });
}

// Every appearance a player has logged this season at a position counts as
// depth at that position — a super-utility player can (correctly) show up
// under several positions at once, ranked by games played at each.
export async function getDepthChart(year: number): Promise<DepthChart> {
  const roster = await getCardinalsRoster(year, "40Man");

  const perPlayerSplits = await Promise.all(
    roster.map(async (player) => ({
      player,
      splits: await getPositionSplits(player.id, year),
    }))
  );

  const byPosition = new Map<string, DepthChartPlayer[]>();
  const starters: DepthChartPlayer[] = [];
  const bullpen: DepthChartPlayer[] = [];

  function addToPosition(position: string, entry: DepthChartPlayer) {
    const list = byPosition.get(position) ?? [];
    list.push(entry);
    byPosition.set(position, list);
  }

  for (const { player, splits } of perPlayerSplits) {
    if (splits.length === 0) {
      // No games logged yet this season (e.g. hurt all year) — fall back to
      // their roster-listed position so they still show up, just last.
      const entry: DepthChartPlayer = { id: player.id, fullName: player.fullName, gamesAtPosition: 0 };

      if (player.position === "P") {
        bullpen.push(entry);
      } else {
        addToPosition(player.position, entry);
      }

      continue;
    }

    for (const split of splits) {
      const abbreviation = split.stat?.position?.abbreviation;
      const gamesPlayed = split.stat?.gamesPlayed ?? 0;
      const gamesStarted = split.stat?.gamesStarted ?? 0;

      if (!abbreviation || gamesPlayed === 0) {
        continue;
      }

      const entry: DepthChartPlayer = {
        id: player.id,
        fullName: player.fullName,
        gamesAtPosition: gamesPlayed,
      };

      if (abbreviation === "P") {
        const isStarter = gamesStarted > 0 && gamesStarted / gamesPlayed > STARTER_RATIO_THRESHOLD;
        (isStarter ? starters : bullpen).push(entry);
        continue;
      }

      addToPosition(abbreviation, entry);
    }
  }

  const positionGroups: DepthChartGroup[] = POSITION_ORDER.map((position) => ({
    position,
    players: sortEntries(byPosition.get(position) ?? []),
  })).filter((group) => group.players.length > 0);

  const knownPositions = new Set(POSITION_ORDER);

  for (const [position, players] of byPosition) {
    if (!knownPositions.has(position)) {
      positionGroups.push({ position, players: sortEntries(players) });
    }
  }

  return {
    positionGroups,
    starters: sortEntries(starters),
    bullpen: sortEntries(bullpen),
  };
}
