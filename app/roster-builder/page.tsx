import { getCardinalsRoster } from "@/lib/mlb";
import RosterBuilder from "@/components/roster-builder/RosterBuilder";

export default async function RosterBuilderPage() {
  const year = new Date().getFullYear();
  const roster = await getCardinalsRoster(year, "40Man");

  return (
    <div style={{ display: "grid", gap: "2rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Players</p>
        <h1 className="section-title">Roster Builder</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          Build out a 26-man active roster from the Cardinals&apos; 40-man players — click a spot
          on the field, DH, bench, rotation, or bullpen to fill it. This is an early, barebones
          version; more roster rules and saving are planned.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        <RosterBuilder roster={roster} />
      </section>
    </div>
  );
}
