import type { StatcastPercentile } from "@/lib/statcast";

const UNQUALIFIED_COLOR = "rgb(200, 200, 200)";

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

function PercentileTile({ metric }: { metric: StatcastPercentile }) {
  const qualified = metric.percentile !== null;
  const percentile = metric.percentile ?? 0;
  const color = qualified ? percentileColor(percentile) : UNQUALIFIED_COLOR;

  return (
    <div
      className="statcast-tile"
      style={{
        border: "1px solid var(--line)",
        borderRadius: "12px",
        padding: "0.65rem 0.75rem 0.75rem",
        display: "grid",
        gap: "0.45rem",
        alignContent: "start",
        opacity: qualified ? 1 : 0.75,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
        <span className="statcast-label" style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--muted)" }}>
          {metric.label}
        </span>
        <span className="statcast-value" style={{ fontWeight: 800, fontSize: "1.05rem" }}>
          {/* Some metrics only come with a percentile — that number is already
              in the circle, so don't repeat it here as if it were a value. */}
          {metric.value ?? ""}
        </span>
      </div>

      <div style={{ position: "relative", height: "8px", borderRadius: "999px", background: "var(--line)" }}>
        {qualified ? (
          <>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${percentile}%`,
                borderRadius: "999px",
                background: color,
              }}
            />
            <div
              className="statcast-marker"
              style={{
                position: "absolute",
                top: "50%",
                left: `${percentile}%`,
                transform: "translate(-50%, -50%)",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: color,
                border: "2px solid var(--panel)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.66rem",
                fontWeight: 800,
                color: "white",
              }}
            >
              {percentile}
            </div>
          </>
        ) : (
          <div style={{ position: "absolute", inset: 0, borderRadius: "999px", background: UNQUALIFIED_COLOR }} />
        )}
      </div>

      {!qualified && (
        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)" }}>Not yet qualified</span>
      )}
    </div>
  );
}

export default function StatcastPercentiles({ metrics }: { metrics: StatcastPercentile[] }) {
  if (metrics.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No Statcast data available for this season yet.</p>;
  }

  return (
    <div className="statcast-percentiles" style={{ display: "grid", gap: "1rem" }}>
      {/* At most four tiles per row (three when the card is narrower). */}
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(max(150px, calc((100% - 2.25rem) / 4)), 1fr))",
        }}
      >
        {metrics.map((metric) => (
          <PercentileTile key={metric.key} metric={metric} />
        ))}
      </div>
    </div>
  );
}
