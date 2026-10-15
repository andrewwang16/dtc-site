export type StatcastPercentile = {
  key: string;
  label: string;
  // Null when the player hasn't reached Savant's qualifying threshold for
  // this metric yet — the value still shows, just without a ranking.
  percentile: number | null;
  value?: string;
};

const NL_TEAM_IDS = new Set([109, 144, 112, 113, 115, 119, 146, 158, 121, 143, 134, 135, 137, 138, 120]);
const AL_TEAM_IDS = new Set([108, 110, 111, 114, 116, 117, 118, 133, 136, 139, 140, 141, 142, 145, 147]);

export function isNationalLeagueTeam(teamId: number): boolean {
  return NL_TEAM_IDS.has(teamId);
}

export function isAmericanLeagueTeam(teamId: number): boolean {
  return AL_TEAM_IDS.has(teamId);
}

// Baseball Savant's percentile rankings already rank players by "goodness"
// per metric, not raw magnitude — e.g. a pitcher's strikeout-rate percentile
// and walk-rate percentile both read high when the pitcher is performing
// well, even though a high K% and a low BB% are opposite directions on the
// raw stat. So every percentile here can be colored on the same scale with
// no per-metric inversion needed.
//
// `rawField` maps a metric to its column name in Savant's separate "custom
// leaderboard" export, which has actual values instead of percentiles.
// Metrics with no `rawField` (max exit velo, arm strength, OAA, bat speed)
// don't have a working raw-value column in that endpoint, so they only
// display a percentile.
const BATTER_METRICS: Array<{ key: string; label: string; rawField?: string }> = [
  { key: "xwoba", label: "xwOBA", rawField: "xwoba" },
  { key: "xba", label: "xBA", rawField: "xba" },
  { key: "xslg", label: "xSLG", rawField: "xslg" },
  { key: "xiso", label: "xISO", rawField: "xiso" },
  { key: "xobp", label: "xOBP", rawField: "xobp" },
  { key: "brl_percent", label: "Barrel %", rawField: "barrel_batted_rate" },
  { key: "exit_velocity", label: "Avg Exit Velocity", rawField: "exit_velocity_avg" },
  { key: "max_ev", label: "Max Exit Velocity" },
  { key: "hard_hit_percent", label: "Hard Hit %", rawField: "hard_hit_percent" },
  { key: "k_percent", label: "Strikeout %", rawField: "k_percent" },
  { key: "bb_percent", label: "Walk %", rawField: "bb_percent" },
  { key: "whiff_percent", label: "Whiff %", rawField: "whiff_percent" },
  { key: "chase_percent", label: "Chase %", rawField: "oz_swing_percent" },
  { key: "sprint_speed", label: "Sprint Speed", rawField: "sprint_speed" },
  { key: "arm_strength", label: "Arm Strength" },
  { key: "oaa", label: "Outs Above Average" },
  { key: "bat_speed", label: "Bat Speed" },
  { key: "squared_up_rate", label: "Squared-Up %", rawField: "squared_up_contact" },
];

const PITCHER_METRICS: Array<{ key: string; label: string; rawField?: string }> = [
  { key: "xera", label: "xERA", rawField: "xera" },
  { key: "xwoba", label: "xwOBA", rawField: "xwoba" },
  { key: "xba", label: "xBA", rawField: "xba" },
  { key: "xslg", label: "xSLG", rawField: "xslg" },
  { key: "xobp", label: "xOBP", rawField: "xobp" },
  { key: "k_percent", label: "Strikeout %", rawField: "k_percent" },
  { key: "bb_percent", label: "Walk %", rawField: "bb_percent" },
  { key: "whiff_percent", label: "Whiff %", rawField: "whiff_percent" },
  { key: "chase_percent", label: "Chase %", rawField: "oz_swing_percent" },
  { key: "brl_percent", label: "Barrel %", rawField: "barrel_batted_rate" },
  { key: "hard_hit_percent", label: "Hard Hit %", rawField: "hard_hit_percent" },
  { key: "exit_velocity", label: "Avg Exit Velocity", rawField: "exit_velocity_avg" },
  { key: "fb_velocity", label: "Fastball Velocity", rawField: "fastball_avg_speed" },
  { key: "fb_spin", label: "Fastball Spin", rawField: "fastball_avg_spin" },
  { key: "curve_spin", label: "Curveball Spin", rawField: "curveball_avg_spin" },
  { key: "arm_strength", label: "Arm Strength" },
];

// Fields already formatted like a batting average ("−.289") by Savant —
// used as-is. Everything else gets a unit appended based on its kind.
const RATE_STRING_FIELDS = new Set(["xwoba", "xba", "xslg", "xiso", "xobp"]);
const PERCENT_FIELDS = new Set([
  "barrel_batted_rate",
  "hard_hit_percent",
  "k_percent",
  "bb_percent",
  "whiff_percent",
  "oz_swing_percent",
  "squared_up_contact",
]);
const MPH_FIELDS = new Set(["exit_velocity_avg", "fastball_avg_speed"]);
const SPIN_FIELDS = new Set(["fastball_avg_spin", "curveball_avg_spin"]);

function formatRawValue(field: string, raw: string): string {
  if (RATE_STRING_FIELDS.has(field)) {
    return raw;
  }

  const num = Number(raw);

  if (!Number.isFinite(num)) {
    return raw;
  }

  if (field === "xera") {
    return num.toFixed(2);
  }

  // No units — the metric label already says what it is ("Hard Hit %",
  // "Avg Exit Velocity"), matching how Savant shows the numbers.
  if (PERCENT_FIELDS.has(field) || MPH_FIELDS.has(field) || field === "sprint_speed") {
    return num.toFixed(1);
  }

  if (SPIN_FIELDS.has(field)) {
    return String(Math.round(num));
  }

  return raw;
}

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

function parseCsv(csv: string): { header: string[]; rows: string[][] } {
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

// Savant's "custom leaderboard" export has real values instead of
// percentiles, but ignores a player_id filter — it always returns the
// full league leaderboard for the year, so this is fetched once per
// (year, type) and reused across every player's page for that season.
async function fetchRawValueLeaderboard(
  year: number,
  type: "batter" | "pitcher",
  fields: string[]
): Promise<{ header: string[]; rows: string[][] }> {
  try {
    const response = await fetch(
      `https://baseballsavant.mlb.com/leaderboard/custom?year=${year}&type=${type}&filter=&min=1&selections=${fields.join(",")}&chart=false&x=xwoba&y=xwoba&r=no&csv=true`,
      { next: { revalidate: 21_600 } }
    );

    if (!response.ok) {
      return { header: [], rows: [] };
    }

    return parseCsv(await response.text());
  } catch (error) {
    console.error("fetchRawValueLeaderboard failed", error);
    return { header: [], rows: [] };
  }
}

export async function getStatcastPercentiles(
  playerId: number,
  year: number,
  type: "batter" | "pitcher"
): Promise<StatcastPercentile[]> {
  const metrics = type === "batter" ? BATTER_METRICS : PITCHER_METRICS;
  const rawFields = metrics.map((metric) => metric.rawField).filter((field): field is string => Boolean(field));

  const [csv, rawLeaderboard] = await Promise.all([
    fetchPercentileCsv(playerId, type),
    fetchRawValueLeaderboard(year, type, rawFields),
  ]);

  const { header, rows } = csv ? parseCsv(csv) : { header: [] as string[], rows: [] as string[][] };
  const yearIndex = header.indexOf("year");
  // A player with too small a sample can be missing from the percentile
  // export entirely; their raw values can still show as not qualified.
  const row = rows.find((cells) => cells[yearIndex] === String(year));

  const rawIdIndex = rawLeaderboard.header.indexOf("player_id");
  const rawRow = rawLeaderboard.rows.find((cells) => cells[rawIdIndex] === String(playerId));

  return metrics
    .map(({ key, label, rawField }): StatcastPercentile | null => {
      const index = header.indexOf(key);
      const rawPercentile = row && index >= 0 ? row[index] : "";
      const parsed = rawPercentile === "" ? null : Number(rawPercentile);
      const percentile = parsed !== null && Number.isFinite(parsed) ? parsed : null;

      let value: string | undefined;

      if (rawField && rawRow) {
        const rawIndex = rawLeaderboard.header.indexOf(rawField);
        const rawValue = rawIndex >= 0 ? rawRow[rawIndex] : "";
        value = rawValue !== "" ? formatRawValue(rawField, rawValue) : undefined;
      }

      // Savant leaves a percentile blank both when a player isn't qualified
      // yet and when the metric doesn't apply (e.g. curveball spin for a
      // pitcher without one). Only a real value says it's the former.
      if (percentile === null && value === undefined) {
        return null;
      }

      return { key, label, percentile, value };
    })
    .filter((entry): entry is StatcastPercentile => entry !== null);
}
