"use client";

import { useRouter } from "next/navigation";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const selectStyle: React.CSSProperties = {
  padding: "0.55rem 0.9rem",
  borderRadius: "999px",
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--text)",
  fontWeight: 700,
  cursor: "pointer",
};

export default function MonthYearPicker({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const years: number[] = [];

  for (let y = currentYear + 1; y >= currentYear - 9; y -= 1) {
    years.push(y);
  }

  function goTo(nextYear: number, nextMonth: number) {
    router.push(`/schedule?month=${nextYear}-${String(nextMonth).padStart(2, "0")}`);
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <select
        aria-label="Month"
        value={month}
        onChange={(event) => goTo(year, Number(event.target.value))}
        style={selectStyle}
      >
        {MONTH_NAMES.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>

      <select
        aria-label="Year"
        value={year}
        onChange={(event) => goTo(Number(event.target.value), month)}
        style={selectStyle}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
