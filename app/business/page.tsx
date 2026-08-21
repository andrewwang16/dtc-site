import Newsletter from "../../components/home/Newsletter";

export default function BusinessPage() {
  return (
    <div style={{ display: "grid", gap: "4rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Business</p>
        <h1 className="section-title">Monetization and Community Reputation</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "64ch" }}>
          Revenue channels, fan trust, and the strategy behind growing Dealin&apos; the Cards into a broader digital sports
          media network.
        </p>
      </section>

      <Newsletter />
    </div>
  );
}
