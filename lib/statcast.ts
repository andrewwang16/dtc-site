export type StatcastPercentile = {
  key: string;
  label: string;
  percentile: number;
  nlRank?: number;
};

// Baseball Savant's team filter for this leaderboard expects these
// abbreviations (Washington is "WSH", not "WSN").
const NL_TEAM_CODES = [
  "ARI",
  "ATL",
  "CHC",
  "CIN",
  "COL",
  "LAD",
  "MIA",
  "MIL",
  "NYM",
  "PHI",
  "PIT",
  "SD",
  "SF",
  "STL",
  "WSH",
];

const NL_TEAM_IDS = new Set([109, 144, 112, 113, 115, 119, 146, 158, 121, 143, 134, 135, 137, 138, 120]);

export function isNationalLeagueTeam(teamId: number): boolean {
  return NL_TEAM_IDS.has(teamId);
}

// Baseball Savant's percentile rankings already rank players by "goodness"
// per metric, not raw magnitude — e.g. a pitcher's strikeout-rate percentile
// and walk-rate percentile both read high when the pitcher is performing
// well, even though a high K% and a low BB% are opposite directions on the
// raw stat. So every percentile here can be colored on the same scale with
// no per-metric inversion needed.
const BATTER_METRICS: Array<{ key: string; label: string }> = [
  { key: "xwoba", label: "xwOBA" },
  { key: "xba", label: "xBA" },
  { key: "xslg", label: "xSLG" },
  { key: "xiso", label: "xISO" },
  { key: "xobp", label: "xOBP" },
  { key: "brl_percent", label: "Barrel %" },
  { key: "exit_velocity", label: "Avg Exit Velocity" },
  { key: "max_ev", label: "Max Exit Velocity" },
  { key: "hard_hit_percent", label: "Hard Hit %" },
  { key: "k_percent", label: "Strikeout %" },
  { key: "bb_percent", label: "Walk %" },
  { key: "whiff_percent", label: "Whiff %" },
  { key: "chase_percent", label: "Chase %" },
  { key: "sprint_speed", label: "Sprint Speed" },
  { key: "arm_strength", label: "Arm Strength" },
  { key: "oaa", label: "Outs Above Average" },
  { key: "bat_speed", label: "Bat Speed" },
  { key: "squared_up_rate", label: "Squared-Up %" },
];

const PITCHER_METRICS: Array<{ key: string; label: string }> = [
  { key: "xera", label: "xERA" },
  { key: "xwoba", label: "xwOBA" },
  { key: "xba", label: "xBA" },
  { key: "xslg", label: "xSLG" },
  { key: "xobp", label: "xOBP" },
  { key: "k_percent", label: "Strikeout %" },
  { key: "bb_percent", label: "Walk %" },
  { key: "whiff_percent", label: "Whiff %" },
  { key: "chase_percent", label: "Chase %" },
  { key: "brl_percent", label: "Barrel %" },
  { key: "hard_hit_percent", label: "Hard Hit %" },
  { key: "exit_velocity", label: "Avg Exit Velocity" },
  { key: "fb_velocity", label: "Fastball Velocity" },
  { key: "fb_spin", label: "Fastball Spin" },
  { key: "curve_spin", label: "Curveball Spin" },
  { key: "arm_strength", label: "Arm Strength" },
];

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

async function fetchPercentileCsv(playerId: number, type: "batter" | "pitcher"): Promise<string | null> {
  try {
    const response = await fetch(
      `https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=${type}&player_id=${playerId}&csv=true`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error("fetchPercentileCsv failed", error);
    return null;
  }
}

export async function getStatcastPercentiles(
  playerId: number,
  year: number,
  type: "batter" | "pitcher"
): Promise<StatcastPercentile[]> {
  const csv = await fetchPercentileCsv(playerId, type);

  if (!csv) {
    return [];
  }

  const cleaned = csv.replace(/^﻿/, "").replace(/\r/g, "");
  const lines = cleaned.trim().split("\n").filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const yearIndex = header.indexOf("year");

  const row = lines
    .slice(1)
    .map(parseCsvLine)
    .find((cells) => cells[yearIndex] === String(year));

  if (!row) {
    return [];
  }

  const metrics = type === "batter" ? BATTER_METRICS : PITCHER_METRICS;

  return metrics
    .map(({ key, label }) => {
      const index = header.indexOf(key);
      const raw = index >= 0 ? row[index] : "";

      if (raw === "") {
        return null;
      }

      const percentile = Number(raw);

      return Number.isFinite(percentile) ? { key, label, percentile } : null;
    })
    .filter((entry): entry is StatcastPercentile => entry !== null);
}

function parsePercentileCsv(csv: string): { header: string[]; rows: string[][] } {
  const cleaned = csv.replace(/^﻿/, "").replace(/\r/g, "");
  const lines = cleaned.trim().split("\n").filter(Boolean);

  if (lines.length === 0) {
    return { header: [], rows: [] };
  }

  return {
    header: parseCsvLine(lines[0]),
    rows: lines.slice(1).map(parseCsvLine),
  };
}

async function fetchTeamPercentileCsv(team: string, year: number, type: "batter" | "pitcher"): Promise<string | null> {
  try {
    const response = await fetch(
      `https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=${type}&team=${team}&year=${year}&min=q&csv=true`,
      { next: { revalidate: 21_600 } }
    );

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error("fetchTeamPercentileCsv failed", team, error);
    return null;
  }
}

// The percentile-rankings leaderboard has no per-team filter that returns
// only qualified rate-stat leaders league-wide, and no team column on each
// row — so the NL pool is built by fetching each of the 15 NL teams'
// qualified players (already ranked "by goodness" per metric by Savant,
// see the comment above) and merging, deduping any player who was on more
// than one NL team in-season. The team filter defaults to the current
// season unless a year is passed explicitly, so it must be passed here.
async function getNlLeaderboard(year: number, type: "batter" | "pitcher") {
  const csvs = await Promise.all(NL_TEAM_CODES.map((team) => fetchTeamPercentileCsv(team, year, type)));

  let header: string[] = [];
  const rowsById = new Map<string, string[]>();

  for (const csv of csvs) {
    if (!csv) {
      continue;
    }

    const parsed = parsePercentileCsv(csv);

    if (parsed.header.length > 0) {
      header = parsed.header;
    }

    const idIndex = parsed.header.indexOf("player_id");
    const yearIndex = parsed.header.indexOf("year");

    for (const row of parsed.rows) {
      if (row[yearIndex] !== String(year)) {
        continue;
      }

      rowsById.set(`${row[idIndex]}-${row[yearIndex]}`, row);
    }
  }

  return { header, rows: Array.from(rowsById.values()) };
}

// A player's rank among National League qualified players for each metric,
// sorted by percentile (already a "goodness" rank per metric, so higher is
// always better — see the comment above BATTER_METRICS). Only returned when
// the player places in the top 50.
export async function getStatcastNlRanks(
  playerId: number,
  year: number,
  type: "batter" | "pitcher"
): Promise<Record<string, number>> {
  const { header, rows } = await getNlLeaderboard(year, type);

  if (header.length === 0) {
    return {};
  }

  const idIndex = header.indexOf("player_id");
  const metrics = type === "batter" ? BATTER_METRICS : PITCHER_METRICS;
  const ranks: Record<string, number> = {};

  for (const { key } of metrics) {
    const colIndex = header.indexOf(key);

    if (colIndex === -1) {
      continue;
    }

    const ranked = rows
      .map((row) => ({ playerId: Number(row[idIndex]), value: row[colIndex] === "" ? null : Number(row[colIndex]) }))
      .filter((entry): entry is { playerId: number; value: number } => entry.value !== null && Number.isFinite(entry.value))
      .sort((a, b) => b.value - a.value);

    const index = ranked.findIndex((entry) => entry.playerId === playerId);

    if (index !== -1 && index < 50) {
      ranks[key] = index + 1;
    }
  }

  return ranks;
}
