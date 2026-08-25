import Link from "next/link";
import { getSeasonTransactions } from "@/lib/transactions";

function formatTransactionDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

type TransactionsPageProps = {
  searchParams: Promise<{ year?: string }>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const { year: yearParam } = await searchParams;
  const currentYear = new Date().getFullYear();
  const requestedYear = Number.parseInt(yearParam ?? "", 10);
  const year = Number.isFinite(requestedYear) && requestedYear >= 1900 ? requestedYear : currentYear;

  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 5; y -= 1) {
    years.push(y);
  }

  const transactions = await getSeasonTransactions(year);

  return (
    <div style={{ display: "grid", gap: "3rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Players</p>
        <h1 className="section-title">Transaction Log</h1>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>{year} Season</h2>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {years.map((y) => (
              <Link
                key={y}
                href={`/transactions?year=${y}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.5rem 0.9rem",
                  borderRadius: "999px",
                  border: `1px solid ${y === year ? "#8a1024" : "var(--line)"}`,
                  background: y === year ? "rgba(196,30,58,0.18)" : "var(--panel)",
                  color: "var(--text)",
                  fontWeight: 700,
                  textDecoration: "none",
                  fontSize: "0.9rem",
                }}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>

        {transactions.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No transactions found for {year}.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {transactions.map((transaction) => (
              <article
                key={transaction.id}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "16px",
                  background: "var(--panel)",
                  padding: "1rem 1.15rem",
                  display: "grid",
                  gap: "0.4rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                    {formatTransactionDate(transaction.date)}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "999px",
                      background: "rgba(15,31,61,0.06)",
                      color: "var(--accent-soft)",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    {transaction.typeDesc}
                  </span>
                </div>

                <p style={{ margin: 0, lineHeight: 1.5 }}>{transaction.description}</p>

                {transaction.personId && transaction.personName && (
                  <Link
                    href={`/players/${transaction.personId}`}
                    style={{ color: "var(--accent-soft)", fontWeight: 700, fontSize: "0.85rem" }}
                  >
                    View {transaction.personName} →
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
