import { NextResponse } from "next/server";
import { determinePlayerRole, getPlayerBio, getPlayerYearStats } from "@/lib/mlb";
import { computeEraPlus, computeWrcPlus, formatPlusStat, getSeasonEnvironment } from "@/lib/park-adjusted";
import { formatWar, getPitcherWar, getPositionPlayerWar } from "@/lib/war";

// WAR and wRC+ (ERA+ for pitchers) for one player's season, computed the
// same way as the player pages — for the client-side Player Comparison.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const playerId = Number(params.get("id"));
  const year = Number(params.get("year"));

  if (!Number.isInteger(playerId) || playerId <= 0 || !Number.isInteger(year)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const bio = await getPlayerBio(playerId);
  if (!bio) {
    return NextResponse.json({ error: "Unknown player" }, { status: 404 });
  }

  const role = determinePlayerRole(bio);
  const group = role === "Pitcher" ? "pitching" : "hitting";
  const [yearStats, environment] = await Promise.all([
    getPlayerYearStats(playerId, year, group),
    getSeasonEnvironment(year),
  ]);
  const stints = yearStats.seasonTeams;
  const stat = yearStats.season;

  const war =
    role === "Pitcher"
      ? (await getPitcherWar(year, stat, stints))?.war
      : (await getPositionPlayerWar(playerId, year, stat, stints, stat?.plateAppearances ?? 0))?.war;

  const plusColumn = role === "Pitcher" ? "ERA+" : "wRC+";
  const plus = environment
    ? formatPlusStat(role === "Pitcher" ? computeEraPlus(stat, stints, environment) : computeWrcPlus(stat, stints, environment))
    : "-";

  return NextResponse.json(
    { role, values: { WAR: formatWar(war), [plusColumn]: plus } },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } }
  );
}
