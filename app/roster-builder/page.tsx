import { getCardinalsRoster, getAllMlbPlayers } from "@/lib/mlb";
import { getCardinalsProspects } from "@/lib/prospects";
import RosterBuilder from "@/components/roster-builder/RosterBuilder";

export default async function RosterBuilderPage() {
  const year = new Date().getFullYear();

  const [roster, prospects, externalPlayers] = await Promise.all([
    getCardinalsRoster(year, "40Man"),
    getCardinalsProspects(year),
    getAllMlbPlayers(year),
  ]);

  return (
    <div style={{ display: "grid", gap: "2rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Players</p>
        <h1 className="section-title">Roster Builder</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          Build out a 26-man active roster from the Cardinals&apos; 40-man players, minor league
          system, or anyone else in MLB — click a spot to fill it. This is an early, barebones
          version; more roster rules and saving are planned.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        <RosterBuilder roster={roster} prospects={prospects} externalPlayers={externalPlayers} />
      </section>
    </div>
  );
}
