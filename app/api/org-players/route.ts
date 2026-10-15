import { NextResponse } from "next/server";
import { MLB_TEAM_IDS } from "@/lib/mlb";
import { getOrganizationPlayers } from "@/lib/prospects";

// Every player in one MLB organization (40-man + affiliates), for the
// roster builder's trade builder.
export async function GET(request: Request) {
  const teamId = Number(new URL(request.url).searchParams.get("teamId"));

  if (!MLB_TEAM_IDS.includes(teamId)) {
    return NextResponse.json({ error: "Unknown team" }, { status: 400 });
  }

  const players = await getOrganizationPlayers(teamId, new Date().getFullYear());
  return NextResponse.json(
    { players },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } }
  );
}
