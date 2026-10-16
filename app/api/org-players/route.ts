import { NextResponse } from "next/server";
import { getPositionUsage, MLB_TEAM_IDS } from "@/lib/mlb";
import { FORTY_MAN_LEVEL, getOrganizationPlayers } from "@/lib/prospects";
import { CONTRACT_SEASON, isImpendingFreeAgent } from "@/lib/contracts";

// Every player in one MLB organization (40-man + affiliates), for the
// roster builder's trade builder.
export async function GET(request: Request) {
  const teamId = Number(new URL(request.url).searchParams.get("teamId"));

  if (!MLB_TEAM_IDS.includes(teamId)) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }

  // Players headed to free agency can't be traded for in a 2027 simulation.
  const players = (await getOrganizationPlayers(teamId, new Date().getFullYear())).filter(
    (player) => !isImpendingFreeAgent(player.id)
  );
  // How the club's big leaguers were used last season, so anyone acquired
  // ranks properly for open roster spots.
  const usage = await getPositionUsage(
    players.filter((player) => player.level === FORTY_MAN_LEVEL).map((player) => player.id),
    CONTRACT_SEASON - 1
  );

  return NextResponse.json(
    { players, usage },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } }
  );
}
