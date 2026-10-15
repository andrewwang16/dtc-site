import { CARDINALS_TEAM_ID } from "@/lib/mlb";

export type ProspectPlayer = {
  id: number;
  fullName: string;
  lastName?: string;
  position: string;
  debutDate?: string;
  bats?: string;
  throws?: string;
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
  person: {
    id: number;
    fullName: string;
    useLastName?: string;
    mlbDebutDate?: string;
    batSide?: { code?: string };
    pitchHand?: { code?: string };
  };
  position: { abbreviation: string };
};

async function fetchAffiliateTeams(parentTeamId: number, year: number): Promise<AffiliateTeam[]> {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/teams/affiliates?teamIds=${parentTeamId}&season=${year}`,
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
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=fullRoster&season=${year}&hydrate=person`,
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

function toProspectPlayer(entry: RosterEntry, level: string): ProspectPlayer {
  return {
    id: entry.person.id,
    fullName: entry.person.fullName,
    lastName: entry.person.useLastName,
    position: entry.position.abbreviation,
    debutDate: entry.person.mlbDebutDate,
    bats: entry.person.batSide?.code,
    throws: entry.person.pitchHand?.code,
    level,
  };
}

// Minor league players across every one of an organization's affiliates,
// deduped (a rehab assignment or optioned player can show up on more than
// one affiliate's roster in a season) and sorted level-first
// (majors-adjacent first), then by name within each level.
export async function getOrganizationProspects(parentTeamId: number, year: number): Promise<ProspectPlayer[]> {
  const affiliateTeams = await fetchAffiliateTeams(parentTeamId, year);

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
      prospects.push(toProspectPlayer(entry, level));
    }
  }

  prospects.sort((a, b) => {
    const levelDiff = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
    return levelDiff !== 0 ? levelDiff : a.fullName.localeCompare(b.fullName);
  });

  return prospects;
}

export function getCardinalsProspects(year: number): Promise<ProspectPlayer[]> {
  return getOrganizationProspects(CARDINALS_TEAM_ID, year);
}

// Level for players on an organization's 40-man roster.
export const FORTY_MAN_LEVEL = "40-man";

// An organization's whole system: its 40-man roster first, then every
// minor leaguer not on it — for building trades with any club.
export async function getOrganizationPlayers(teamId: number, year: number): Promise<ProspectPlayer[]> {
  const [fortyMan, prospects] = await Promise.all([
    (async () => {
      try {
        const response = await fetch(
          `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=40Man&season=${year}&hydrate=person`,
          { next: { revalidate: 21_600 } }
        );
        const data: { roster?: RosterEntry[] } = response.ok ? await response.json() : {};
        return (data.roster ?? []).map((entry) => toProspectPlayer(entry, FORTY_MAN_LEVEL));
      } catch (error) {
        console.error("getOrganizationPlayers 40-man failed", teamId, error);
        return [];
      }
    })(),
    getOrganizationProspects(teamId, year),
  ]);

  const fortyManIds = new Set(fortyMan.map((player) => player.id));
  fortyMan.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return [...fortyMan, ...prospects.filter((player) => !fortyManIds.has(player.id))];
}
