import { CARDINALS_TEAM_ID } from "@/lib/mlb";

export type ProspectPlayer = {
  id: number;
  fullName: string;
  position: string;
  level: string;
};

// Order to sort/group prospects by, majors-adjacent level first. Any
// affiliate sport name not in this list (e.g. administrative "Minor
// League Baseball" grouping teams) is skipped entirely.
const LEVEL_ORDER = ["Triple-A", "Double-A", "High-A", "Single-A", "Rookie"];

type AffiliateTeam = {
  id: number;
  sport?: { name?: string };
};

type RosterEntry = {
  person: { id: number; fullName: string };
  position: { abbreviation: string };
};

async function fetchAffiliateTeams(year: number): Promise<AffiliateTeam[]> {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/affiliates?teamIds=${CARDINALS_TEAM_ID}&season=${year}`,
      { next: { revalidate: 21_600 } }
    );

    if (!response.ok) {
      return [];
    }

    const data: { teams?: AffiliateTeam[] } = await response.json();

    return (data.teams ?? []).filter((team) => LEVEL_ORDER.includes(team.sport?.name ?? ""));
  } catch (error) {
    console.error("fetchAffiliateTeams failed", error);
    return [];
  }
}

async function fetchAffiliateRoster(teamId: number, year: number): Promise<RosterEntry[]> {
  try {
    // "fullSeason" accumulates everyone who was ever on the roster this
    // year, including players since traded/released/DFA'd out of the org.
    // "active" excludes anyone hurt. "fullRoster" is the one that reflects
    // who's actually still with the organization right now, active or
    // injured (confirmed: excludes departed players, includes long-term
    // injured ones like a 60-day IL pitcher).
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=fullRoster&season=${year}`,
      { next: { revalidate: 21_600 } }
    );

    if (!response.ok) {
      return [];
    }

    const data: { roster?: RosterEntry[] } = await response.json();

    return data.roster ?? [];
  } catch (error) {
    console.error("fetchAffiliateRoster failed", teamId, error);
    return [];
  }
}

// Minor league players across every Cardinals affiliate, deduped (a rehab
// assignment or optioned player can show up on more than one affiliate's
// roster in a season) and sorted level-first (majors-adjacent first), then
// by name within each level.
export async function getCardinalsProspects(year: number): Promise<ProspectPlayer[]> {
  const affiliateTeams = await fetchAffiliateTeams(year);

  const rostersByTeam = await Promise.all(
    affiliateTeams.map(async (team) => ({
      level: team.sport?.name ?? "Minors",
      roster: await fetchAffiliateRoster(team.id, year),
    }))
  );

  const seen = new Set<number>();
  const prospects: ProspectPlayer[] = [];

  for (const { level, roster } of rostersByTeam) {
    for (const entry of roster) {
      if (seen.has(entry.person.id)) {
        continue;
      }

      seen.add(entry.person.id);
      prospects.push({
        id: entry.person.id,
        fullName: entry.person.fullName,
        position: entry.position.abbreviation,
        level,
      });
    }
  }

  prospects.sort((a, b) => {
    const levelDiff = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
    return levelDiff !== 0 ? levelDiff : a.fullName.localeCompare(b.fullName);
  });

  return prospects;
}
