const farmTopics = [
  "Top prospect tracking",
  "MLB Draft coverage",
  "Affiliate-level recaps",
  "Prospect interviews",
  "Arizona Fall League analysis",
  "Farm system rankings",
];

export default function ProspectSection() {
  return (
    <section className="container fade-up" style={{ animationDelay: "0.2s" }}>
      <p className="kicker">Birds on the Farm</p>
      <h2 className="section-title">Prospect-Centric Coverage Stack</h2>

      <div
        style={{
          marginTop: "1.2rem",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "1.25rem",
        }}
      >
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          This recurring show is almost exclusively dedicated to the Cardinals minor league pipeline and player development.
        </p>

        <div
          style={{
            marginTop: "0.85rem",
            display: "grid",
            gap: "0.65rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          }}
        >
          {farmTopics.map((topic) => (
            <div key={topic} style={{ border: "1px solid rgba(15,31,61,0.38)", borderRadius: "12px", padding: "0.75rem" }}>
              {topic}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
