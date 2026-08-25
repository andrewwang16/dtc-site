import { getCardinalsRoster, type RosterEntry } from "@/lib/mlb";

const POSITION_ORDER = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

const NAME_SUFFIXES = new Set(["Jr.", "Jr", "Sr.", "Sr", "II", "III", "IV", "V"]);

function getLastName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  let lastIndex = parts.length - 1;

  while (lastIndex > 0 && NAME_SUFFIXES.has(parts[lastIndex])) {
    lastIndex -= 1;
  }

  return parts[lastIndex] ?? fullName;
}

function sortByLastName(a: RosterEntry, b: RosterEntry) {
  return getLastName(a.fullName).localeCompare(getLastName(b.fullName));
}

export type DepthChartGroup = {
  position: string;
  players: RosterEntry[];
};

export type DepthChart = {
  positionGroups: DepthChartGroup[];
  pitchers: RosterEntry[];
};

// A real organizational depth chart ranks players by scouting/coaching
// judgment, which isn't public data — this groups the 40-man roster by
// primary position (alphabetical within each group) as a first pass, per
// the MLB.com-style layout. Ranking by playing time is a reasonable next
// improvement once this needs to be more than a v1.
export async function getDepthChart(year: number): Promise<DepthChart> {
  const roster = await getCardinalsRoster(year, "40Man");

  const byPosition = new Map<string, RosterEntry[]>();
  const pitchers: RosterEntry[] = [];

  for (const player of roster) {
    if (player.position === "P") {
      pitchers.push(player);
      continue;
    }

    const list = byPosition.get(player.position) ?? [];
    list.push(player);
    byPosition.set(player.position, list);
  }

  const positionGroups: DepthChartGroup[] = POSITION_ORDER.map((position) => ({
    position,
    players: (byPosition.get(position) ?? []).slice().sort(sortByLastName),
  })).filter((group) => group.players.length > 0);

  const knownPositions = new Set(POSITION_ORDER);

  for (const [position, players] of byPosition) {
    if (!knownPositions.has(position)) {
      positionGroups.push({ position, players: players.slice().sort(sortByLastName) });
    }
  }

  pitchers.sort(sortByLastName);

  return { positionGroups, pitchers };
}
