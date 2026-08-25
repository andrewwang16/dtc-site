import type { MonthlyGrade } from "@/lib/grades";

const GRADE_COLORS: Record<string, string> = {
  "A+": "#0d7a3c",
  A: "#2f9e52",
  B: "#8a9a2e",
  C: "#c2941a",
  D: "#c0622b",
  F: "#b42318",
};

const NA_COLOR = "rgba(15,31,61,0.06)";

function GradeChip({ month, grade, link }: MonthlyGrade) {
  const background = grade ? GRADE_COLORS[grade] ?? "#6b7280" : NA_COLOR;
  const color = grade ? "white" : "var(--muted)";

  const content = (
    <>
      <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", opacity: 0.85 }}>
        {month}
      </span>
      <span style={{ fontSize: "1.25rem", fontWeight: 900, lineHeight: 1 }}>{grade ?? "N/A"}</span>
    </>
  );

  const style: React.CSSProperties = {
    display: "grid",
    justifyItems: "center",
    gap: "0.35rem",
    padding: "0.7rem 0.6rem",
    borderRadius: "14px",
    border: grade ? "1px solid transparent" : "1px solid var(--line)",
    background,
    color,
    minWidth: "68px",
    textDecoration: "none",
  };

  if (link) {
    return (
      <a href={link} target="_blank" rel="noreferrer" style={style} title={`Watch the ${month} grades video`}>
        {content}
      </a>
    );
  }

  return <div style={style}>{content}</div>;
}

export default function PlayerGrades({ grades }: { grades: MonthlyGrade[] }) {
  if (grades.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "1.15rem",
        display: "flex",
        gap: "0.6rem",
        flexWrap: "wrap",
      }}
    >
      {grades.map((entry) => (
        <GradeChip key={entry.month} {...entry} />
      ))}
    </div>
  );
}
