import SchedulePreview from "../../components/home/SchedulePreview";
import StandingsPreview from "../../components/home/StandingsPreview";

export default function AudiencePage() {
  return (
    <div style={{ display: "grid", gap: "2.75rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Audience</p>
        <h1 className="section-title">Public Audience Signals</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          Ratings, platform presence, and social reach that reflect a fast-growing independent Cardinals community.
        </p>
      </section>

      <StandingsPreview />

      <SchedulePreview />
    </div>
  );
}
