import ScheduleCalendar from "@/components/schedule/ScheduleCalendar";
import { CARDINALS_TEAM_ID, type MlbGame } from "@/components/schedule/scheduleUtils";

type MlbScheduleResponse = {
  dates?: Array<{
    date: string;
    games: MlbGame[];
  }>;
};

async function loadSchedule(startDate: string, endDate: string) {
  try {
    const response = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${CARDINALS_TEAM_ID}&startDate=${startDate}&endDate=${endDate}&hydrate=team,probablePitcher,venue,decisions`,
      {
        next: {
          revalidate: 300,
        },
      }
    );

    if (!response.ok) {
      return [] as Array<{ date: string; games: MlbGame[] }>;
    }

    const data: MlbScheduleResponse = await response.json();
    return data.dates ?? [];
  } catch {
    return [] as Array<{ date: string; games: MlbGame[] }>;
  }
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function monthParam(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

type SchedulePageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const params = await searchParams;

  let year = currentYear;
  let month = now.getMonth() + 1;

  const match = params.month?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const parsedYear = Number(match[1]);
    const parsedMonth = Number(match[2]);

    if (parsedMonth >= 1 && parsedMonth <= 12) {
      year = parsedYear;
      month = parsedMonth;
    }
  }

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;

  const monthGamesByDate = await loadSchedule(monthStart, monthEnd);

  const prevMonthDate = new Date(year, month - 2, 1);
  const nextMonthDate = new Date(year, month, 1);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));

  return (
    <div style={{ display: "grid", gap: "5.5rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Schedule</p>
        <h1 className="section-title">Cardinals Schedule</h1>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.08s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{monthLabel}</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <a
              href={`?month=${monthParam(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.55rem 0.9rem",
                border: "1px solid var(--line)",
                borderRadius: "999px",
                background: "var(--panel)",
                color: "var(--text)",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              ← Prev
            </a>
            <a
              href={`?month=${monthParam(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.55rem 0.9rem",
                border: "1px solid var(--line)",
                borderRadius: "999px",
                background: "var(--panel)",
                color: "var(--text)",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Next →
            </a>
          </div>
        </div>

        <ScheduleCalendar year={year} month={month} gamesByDate={monthGamesByDate} />
      </section>
    </div>
  );
}
