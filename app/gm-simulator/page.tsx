import { getFortyManSplit } from "@/lib/mlb";
import { getOrganizationProspects } from "@/lib/prospects";
import { parseTeamParam } from "@/lib/teams";
import { isImpendingFreeAgent } from "@/lib/contracts";
import RosterBuilder from "@/components/roster-builder/RosterBuilder";

type GmSimulatorPageProps = {
  searchParams: Promise<{ team?: string }>;
};

export default async function GmSimulatorPage({ searchParams }: GmSimulatorPageProps) {
  const { team: teamParam } = await searchParams;
  // Defaults to the Cardinals; ?team= takes an abbreviation ("nyy") or id.
  const teamId = parseTeamParam(teamParam);
  const year = new Date().getFullYear();

  const [{ active: fullRoster, sixtyDayIL: fullSixtyDayIL }, allProspects] = await Promise.all([
    getFortyManSplit(year, teamId),
    getOrganizationProspects(teamId, year),
  ]);

  // The builder simulates 2027, so players whose contracts are up are left
  // off (they're in the Free Agents tab instead).
  const departing = [...fullRoster, ...fullSixtyDayIL].filter((player) => isImpendingFreeAgent(player.id));
  function staying<T extends { id: number }>(players: T[]) {
    return players.filter((player) => !isImpendingFreeAgent(player.id));
  }
  const roster = staying(fullRoster);
  const sixtyDayIL = staying(fullSixtyDayIL);
  const prospects = staying(allProspects);

  return (
    <div style={{ display: "grid", gap: "1rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <h1 className="section-title">GM Simulator</h1>
        <p style={{ marginTop: "0.6rem", color: "var(--muted)", maxWidth: "68ch", lineHeight: 1.5 }}>
          Run any club&apos;s 2027 roster: pick a team, then trade, sign free agents, and extend players while payroll
          and the luxury tax update live. Drag players into the lineup, rotation, bullpen, and bench to set your 26-man,
          then download a graphic of it.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        {/* Keyed by team so switching clubs starts a fresh builder. */}
        <RosterBuilder
          key={teamId}
          teamId={teamId}
          roster={roster}
          prospects={prospects}
          sixtyDayIL={sixtyDayIL}
          departingFreeAgents={departing.map((player) => player.fullName)}
        />
      </section>
    </div>
  );
}
