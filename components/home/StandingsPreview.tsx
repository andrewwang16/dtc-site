const metrics = [
  { label: "Apple Podcasts", score: "4.3/5", notes: "50+ public ratings" },
  { label: "Spotify", score: "4.8/5", notes: "90+ public ratings" },
  { label: "YouTube Livestreams", score: "1,000-3,000+", notes: "Typical view range" },
  { label: "Special Videos", score: "5,000-10,000+", notes: "Often higher on major topics" },
];

export default function StandingsPreview() {
  return (
    <section className="container fade-up" id="audience" style={{ animationDelay: "0.36s" }}>
      <p className="kicker">Audience Snapshot</p>
      <h2 className="section-title">Public Growth Indicators</h2>

      <div
        style={{
          marginTop: "1.2rem",
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        {metrics.map((metric) => (
          <article key={metric.label} style={{ border: "1px solid var(--line)", borderRadius: "18px", background: "var(--panel)", padding: "1rem" }}>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.93rem" }}>{metric.label}</p>
            <h3 style={{ margin: "0.4rem 0 0", fontFamily: "Anton, sans-serif", fontSize: "2rem", letterSpacing: "0.02em" }}>
              {metric.score}
            </h3>
            <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.88rem" }}>{metric.notes}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
