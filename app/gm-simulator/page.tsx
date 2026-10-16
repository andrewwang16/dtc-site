import { getFortyManSplit } from "@/lib/mlb";
import { getOrganizationProspects } from "@/lib/prospects";
import { getTeamInfo, parseTeamParam } from "@/lib/teams";
import RosterBuilder from "@/components/roster-builder/RosterBuilder";

type RosterBuilderPageProps = {
  searchParams: Promise<{ team?: string }>;
};

export default async function RosterBuilderPage({ searchParams }: RosterBuilderPageProps) {
  const { team: teamParam } = await searchParams;
  // Defaults to the Cardinals; ?team= takes an abbreviation ("nyy") or id.
  const teamId = parseTeamParam(teamParam);
  const team = getTeamInfo(teamId);
  const year = new Date().getFullYear();

  const [{ active: roster, sixtyDayIL }, prospects] = await Promise.all([
    getFortyManSplit(year, teamId),
    getOrganizationProspects(teamId, year),
  ]);

  return (
    <div style={{ display: "grid", gap: "1rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Players</p>
        <h1 className="section-title">Roster Builder</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          Build out a 26-man active roster for any club — start from the {team.name}&apos; 40-man players and
          minor league system, then trade, sign, and extend. Drag a player onto a spot, or click a spot to search.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        {/* Keyed by team so switching clubs starts a fresh builder. */}
        <RosterBuilder key={teamId} teamId={teamId} roster={roster} prospects={prospects} sixtyDayIL={sixtyDayIL} />
      </section>
    </div>
  );
}
