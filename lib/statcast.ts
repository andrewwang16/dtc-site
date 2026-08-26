export type StatcastPercentile = {
  key: string;
  label: string;
  percentile: number;
};

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
