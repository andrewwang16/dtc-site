const platforms = ["Apple Podcasts", "Spotify", "YouTube"];
const social = ["X (Twitter)", "Instagram", "TikTok"];

export default function SchedulePreview() {
  return (
    <section className="container fade-up" style={{ animationDelay: "0.32s" }}>
      <p className="kicker">Distribution</p>
      <h2 className="section-title">Where Fans Follow Dealin&apos; the Cards</h2>

      <div
        style={{
          marginTop: "1.2rem",
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        <article style={{ border: "1px solid var(--line)", borderRadius: "18px", background: "var(--panel)", padding: "1.15rem" }}>
          <h3 style={{ marginTop: 0 }}>Podcast Platforms</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {platforms.map((name) => (
              <span key={name} style={{ border: "1px solid rgba(15,31,61,0.42)", borderRadius: "999px", padding: "0.4rem 0.8rem" }}>
                {name}
              </span>
            ))}
          </div>
        </article>

        <article style={{ border: "1px solid var(--line)", borderRadius: "18px", background: "var(--panel)", padding: "1.15rem" }}>
          <h3 style={{ marginTop: 0 }}>Social Handles</h3>
          <p style={{ marginTop: "0.2rem", color: "var(--muted)" }}>Active presence through @DealinTheCards.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {social.map((name) => (
              <span key={name} style={{ border: "1px solid rgba(15,31,61,0.42)", borderRadius: "999px", padding: "0.4rem 0.8rem" }}>
                {name}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
