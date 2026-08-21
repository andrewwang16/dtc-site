const monetization = [
  "YouTube memberships",
  "Merchandise",
  "Affiliate partnerships (including Lids)",
  "Sponsor promotions (ex: 314 Sports Cards and fantasy sports promos)",
  "StreamYard affiliate links",
  "Voicemail line for listener interaction",
];

export default function Newsletter() {
  return (
    <section className="container fade-up" id="business" style={{ animationDelay: "0.4s", paddingBottom: "2.5rem" }}>
      <p className="kicker">Business and Community</p>
      <h2 className="section-title">Monetization and Reputation</h2>

      <div
        style={{
          marginTop: "1.2rem",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          padding: "1.25rem",
          background: "linear-gradient(170deg, rgba(196,30,58,0.25), rgba(39,13,20,0.95) 52%)",
        }}
      >
        <p style={{ marginTop: 0, color: "var(--muted)", lineHeight: 1.6 }}>
          Fans often cite strong chemistry, frequent uploads, and prospect depth. A recurring critique is occasional audio
          level inconsistency between hosts. Overall community sentiment is positive and still trending up.
        </p>

        <h3 style={{ marginBottom: "0.45rem" }}>Revenue streams</h3>
        <ul style={{ marginTop: 0, paddingLeft: "1rem", lineHeight: 1.6 }}>
          {monetization.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
