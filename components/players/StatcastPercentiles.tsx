import type { StatcastPercentile } from "@/lib/statcast";

// Blue (bad) -> light gray (average) -> red (good), matching Baseball
// Savant's own percentile-chart coloring.
function percentileColor(percentile: number) {
  const clamped = Math.max(0, Math.min(100, percentile));

  const stops =
    clamped <= 50
      ? { from: [63, 110, 214], to: [225, 225, 225], t: clamped / 50 }
      : { from: [225, 225, 225], to: [214, 80, 74], t: (clamped - 50) / 50 };

  const [r1, g1, b1] = stops.from;
  const [r2, g2, b2] = stops.to;
  const r = Math.round(r1 + (r2 - r1) * stops.t);
  const g = Math.round(g1 + (g2 - g1) * stops.t);
  const b = Math.round(b1 + (b2 - b1) * stops.t);

  return `rgb(${r}, ${g}, ${b})`;
}

function PercentileCell({ metric }: { metric: StatcastPercentile }) {
  const color = percentileColor(metric.percentile);

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "14px",
        padding: "1rem 0.75rem",
        display: "grid",
        gap: "0.6rem",
        justifyItems: "center",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--muted)" }}>{metric.label}</span>
      <div
        style={{
          width: "76px",
          height: "76px",
          borderRadius: "50%",
          background: color,
          border: "3px solid var(--panel)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.6rem",
          fontWeight: 800,
          color: "white",
        }}
      >
        {metric.percentile}
      </div>
      {metric.nlRank && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.2rem 0.6rem",
            borderRadius: "999px",
            background: "rgba(15,31,61,0.06)",
            color: "var(--accent-soft)",
            fontWeight: 700,
            fontSize: "0.72rem",
          }}
        >
          NL #{metric.nlRank}
        </span>
      )}
    </div>
  );
}

export default function StatcastPercentiles({ metrics }: { metrics: StatcastPercentile[] }) {
  if (metrics.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No Statcast data available for this season yet.</p>;
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
        League percentile rank for each metric — red is elite, blue is below average.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.75rem" }}>
        {metrics.map((metric) => (
          <PercentileCell key={metric.key} metric={metric} />
        ))}
      </div>
    </div>
  );
}
