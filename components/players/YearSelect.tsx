"use client";

import { useRouter } from "next/navigation";

export default function YearSelect({
  playerId,
  years,
  selectedYear,
  view,
}: {
  playerId: number;
  years: number[];
  selectedYear: number;
  view?: string;
}) {
  const router = useRouter();

  return (
    <select
      value={selectedYear}
      onChange={(event) => {
        const viewQuery = view ? `&view=${view}` : "";
        router.push(`/players/${playerId}?year=${event.target.value}${viewQuery}`);
      }}
      style={{
        padding: "0.6rem 1rem",
        borderRadius: "999px",
        border: "1px solid var(--line)",
        background: "var(--panel)",
        color: "var(--text)",
        fontWeight: 700,
        fontSize: "0.95rem",
      }}
    >
      {years.map((year) => (
        <option key={year} value={year}>
          {year} Season
        </option>
      ))}
    </select>
  );
}
