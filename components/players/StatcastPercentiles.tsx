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

function PercentileRow({ metric }: { metric: StatcastPercentile }) {
  const color = percentileColor(metric.percentile);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", alignItems: "center", gap: "0.85rem" }}>
      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{metric.label}</span>
      <div style={{ position: "relative", height: "10px", borderRadius: "999px", background: "var(--line)" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${metric.percentile}%`,
            borderRadius: "999px",
            background: color,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${metric.percentile}%`,
            transform: "translate(-50%, -50%)",
            width: "26px",
            height: "26px",
            borderRadius: "50%",
            background: color,
            border: "2px solid var(--panel)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.68rem",
            fontWeight: 800,
            color: "white",
          }}
        >
          {metric.percentile}
        </div>
      </div>
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
      <div style={{ display: "grid", gap: "0.85rem" }}>
        {metrics.map((metric) => (
          <PercentileRow key={metric.key} metric={metric} />
        ))}
      </div>
    </div>
  );
}
