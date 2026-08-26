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

function rankLabel(rank: number | undefined) {
  if (rank === 1) return "1st in NL";
  if (rank === 2) return "2nd in NL";
  if (rank === 3) return "3rd in NL";
  if (rank !== undefined) return `NL #${rank}`;
  return null;
}

export default function SeasonStatCells({
  columns,
  row,
  ranks,
}: {
  columns: readonly string[];
  row: StatRow;
  ranks: Record<string, number>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.75rem" }}>
      {columns.map((column) => {
        const rank = ranks[column];
        const label = rankLabel(rank);

        return (
          <div
            key={column}
            style={{
              border: `2px solid ${rankOutline(rank)}`,
              borderRadius: "14px",
              padding: "0.9rem 0.6rem",
              display: "grid",
              gap: "0.4rem",
              justifyItems: "center",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)" }}>{column}</span>
            <span style={{ fontSize: "1.4rem", fontWeight: 800 }}>{row[column] ?? "-"}</span>
            {label && <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)" }}>{label}</span>}
          </div>
        );
      })}
    </div>
  );
}
