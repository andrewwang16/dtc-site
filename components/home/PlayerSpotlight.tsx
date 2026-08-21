const mainHosts = [
  "Josh Jacobs",
  "Sandy McMillan",
  "Andrew Wang",
];

const birdsOnFarmHosts = ["Kareem Haq", "Aidan", "Tyler"];

export default function PlayerSpotlight() {
  return (
    <section className="container fade-up" id="shows" style={{ animationDelay: "0.16s" }}>
      <p className="kicker">Shows and Talent</p>
      <h2 className="section-title">The People Behind The Network</h2>

      <div
        style={{
          marginTop: "1.2rem",
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        <article style={{ border: "1px solid var(--line)", borderRadius: "18px", background: "var(--panel)", padding: "1.2rem" }}>
          <h3 style={{ marginTop: 0 }}>Dealin&apos; the Cards (Main Show)</h3>
          <p style={{ color: "var(--muted)" }}>Independent Cardinals analysis show launched in 2023.</p>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1rem", lineHeight: 1.55 }}>
            {mainHosts.map((host) => (
              <li key={host}>{host}</li>
            ))}
          </ul>
        </article>

        <article style={{ border: "1px solid var(--line)", borderRadius: "18px", background: "var(--panel)", padding: "1.2rem" }}>
          <h3 style={{ marginTop: 0 }}>Birds on the Farm</h3>
          <p style={{ color: "var(--muted)" }}>Prospects and minor league focused companion series.</p>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1rem", lineHeight: 1.55 }}>
            {birdsOnFarmHosts.map((host) => (
              <li key={host}>{host}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
