const docs = [
  "Top 10 Greatest Cardinals Players",
  "Top 30 Prospect Rankings",
  "John Mozeliak trade history",
  "Greatest Cardinals games revisited",
  "Player deep dives and story episodes",
];

export default function LatestVideos() {
  return (
    <section className="container fade-up" style={{ animationDelay: "0.24s" }}>
      <p className="kicker">YouTube Expansion</p>
      <h2 className="section-title">Long-Form Video Performance</h2>

      <div
        style={{
          marginTop: "1.2rem",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "1.25rem",
        }}
      >
        <p style={{ marginTop: 0, color: "var(--muted)", maxWidth: "63ch" }}>
          Special documentary-style uploads usually outperform standard episode reposts and often become key discovery points
          for new audience growth.
        </p>

        <ul style={{ margin: "0.7rem 0 0", paddingLeft: "1rem", lineHeight: 1.65 }}>
          {docs.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
