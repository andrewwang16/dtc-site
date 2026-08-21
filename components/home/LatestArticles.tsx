const additionalShows = [
  {
    show: "Note News",
    detail: "St. Louis Blues-focused hockey show within the broader media network.",
  },
  {
    show: "Call to the 'Pen",
    detail: "Interview and baseball discussion series with broader league context.",
  },
];

const notableGuests = [
  "Bernie Miklasz (multiple appearances)",
  "Cardinals prospects",
  "Cardinals media members",
  "Baseball analysts",
];

export default function LatestArticles() {
  return (
    <section className="container fade-up" style={{ animationDelay: "0.28s" }}>
      <p className="kicker">Network Layers</p>
      <h2 className="section-title">Beyond The Main Podcast Feed</h2>

      <div
        style={{
          marginTop: "1.2rem",
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        }}
      >
        <article style={{ border: "1px solid var(--line)", borderRadius: "18px", background: "var(--panel)", padding: "1.15rem" }}>
          <h3 style={{ marginTop: 0 }}>Additional Podcasts</h3>
          {additionalShows.map((item) => (
            <p key={item.show} style={{ color: "var(--muted)", marginBottom: "0.65rem" }}>
              <strong style={{ color: "var(--text)" }}>{item.show}:</strong> {item.detail}
            </p>
          ))}
        </article>

        <article style={{ border: "1px solid var(--line)", borderRadius: "18px", background: "var(--panel)", padding: "1.15rem" }}>
          <h3 style={{ marginTop: 0 }}>Guest Ecosystem</h3>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1rem", lineHeight: 1.6, color: "var(--muted)" }}>
            {notableGuests.map((guest) => (
              <li key={guest}>{guest}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
