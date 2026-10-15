import type { StatRow } from "@/lib/mlb";

const GOLD = "#d4af37";
const SILVER = "#a8a8a8";
const BRONZE = "#b08d57";
const RED = "#b42318";

function rankOutline(rank: number | undefined) {
  if (rank === 1) return GOLD;
  if (rank === 2) return SILVER;
  if (rank === 3) return BRONZE;
  if (rank !== undefined && rank <= 50) return RED;
  return "var(--line)";
}

function rankLabel(rank: number | undefined, scope: "NL" | "AL" | "MLB" | null) {
  if (rank === undefined || !scope) {
    return null;
  }

  const scopeLabel = scope === "MLB" ? "MLB" : `the ${scope}`;

  if (rank === 1) return `1st in ${scopeLabel}`;
  if (rank === 2) return `2nd in ${scopeLabel}`;
  if (rank === 3) return `3rd in ${scopeLabel}`;
  return `${scope} #${rank}`;
}

export default function SeasonStatCells({
  columns,
  row,
  ranks,
  scope,
  highlighted = [],
  tooltips = {},
}: {
  columns: readonly string[];
  row: StatRow;
  ranks: Record<string, number>;
  scope: "NL" | "AL" | "MLB" | null;
  // Columns to set apart with a light red tint (e.g. WAR, wRC+).
  highlighted?: readonly string[];
  // Explanations shown on hover (or tap/focus) over a cell; "\n" breaks lines.
  tooltips?: Record<string, string>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.75rem" }}>
      {columns.map((column) => {
        const rank = ranks[column];
        const label = rankLabel(rank, scope);
        const tooltip = tooltips[column];

        return (
          <div
            key={column}
            className={tooltip ? "stat-cell has-tooltip" : "stat-cell"}
            tabIndex={tooltip ? 0 : undefined}
            aria-label={tooltip ? `${column} ${row[column] ?? "-"}. ${tooltip.replace(/\n/g, ". ")}` : undefined}
            style={{
              position: "relative",
              cursor: tooltip ? "help" : undefined,
              border: `2px solid ${rankOutline(rank)}`,
              borderRadius: "14px",
              background: highlighted.includes(column) ? "rgba(196,30,58,0.08)" : undefined,
              padding: "0.9rem 0.6rem",
              display: "grid",
              gap: "0.4rem",
              justifyItems: "center",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "var(--muted)",
                textDecoration: tooltip ? "underline dotted" : undefined,
                textUnderlineOffset: "3px",
              }}
            >
              {column}
            </span>
            <span style={{ fontSize: "1.4rem", fontWeight: 800 }}>{row[column] ?? "-"}</span>
            {label && <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)" }}>{label}</span>}
            {tooltip && (
              <span className="stat-cell-tooltip" role="tooltip">
                {tooltip}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
