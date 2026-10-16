import { NextResponse } from "next/server";
import { MLB_TEAM_IDS } from "@/lib/mlb";
import { getOrganizationPlayers } from "@/lib/prospects";
import { isImpendingFreeAgent } from "@/lib/contracts";

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
  return NextResponse.json(
    { players },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } }
  );
}
