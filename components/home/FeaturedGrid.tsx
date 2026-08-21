const features = [
  {
    title: "Viewer Q&A",
    text: "Trade ideas, lineup projections, player development, and organizational strategy discussions with fans.",
  },
  {
    title: "Special Documentaries",
    text: "Top player lists, prospect rankings, Cardinals history deep dives, trade history explainers, and game retrospectives.",
  },
  {
    title: "Guest Segments",
    text: "Recurring collaborations and interviews with Cardinals media voices and prospects.",
  },
  {
    title: "Community Style",
    text: "Conversational format blending analytics, baseball knowledge, and fan-first interaction.",
  },
];

export default function FeaturedGrid() {
  return (
    <section className="container fade-up" style={{ animationDelay: "0.12s" }}>
      <p className="kicker">Content Identity</p>
      <h2 className="section-title">What Makes The Brand Distinct</h2>
      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          marginTop: "1.2rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {features.map((card) => (
          <article
            key={card.title}
            style={{
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "linear-gradient(170deg, rgba(196,30,58,0.24), rgba(42,14,20,0.95) 58%)",
              padding: "1.1rem",
            }}
          >
            <h3 style={{ margin: 0 }}>{card.title}</h3>
            <p style={{ marginTop: "0.7rem", color: "var(--muted)", lineHeight: 1.55 }}>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
