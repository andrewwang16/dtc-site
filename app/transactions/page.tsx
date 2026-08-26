import Link from "next/link";
import { getSeasonTransactions, type TransactionPlayer } from "@/lib/transactions";

const TRANSACTIONS_PER_PAGE = 20;

function formatTransactionDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type TransactionColor = { background: string; color: string };

// Grouped by what actually happened to the player, not the raw MLB
// typeDesc string, since e.g. "Recalled"/"Selected"/"Rule 5 Selection"
// are all really "called up to the majors."
const TRANSACTION_COLORS: Record<string, TransactionColor> = {
  Trade: { background: "rgba(124,58,237,0.12)", color: "#7c3aed" },
  Acquired: { background: "rgba(124,58,237,0.12)", color: "#7c3aed" },
  Obtained: { background: "rgba(124,58,237,0.12)", color: "#7c3aed" },

  Recalled: { background: "rgba(22,163,74,0.12)", color: "#16a34a" },
  Selected: { background: "rgba(22,163,74,0.12)", color: "#16a34a" },
  "Rule 5 Selection": { background: "rgba(22,163,74,0.12)", color: "#16a34a" },

  Optioned: { background: "rgba(217,119,6,0.14)", color: "#b45309" },
  Outrighted: { background: "rgba(217,119,6,0.14)", color: "#b45309" },
  Assigned: { background: "rgba(217,119,6,0.14)", color: "#b45309" },
  "Rule 5 Draft Minors": { background: "rgba(217,119,6,0.14)", color: "#b45309" },

  "Designated for Assignment": { background: "rgba(180,35,24,0.12)", color: "#b42318" },
  Released: { background: "rgba(180,35,24,0.12)", color: "#b42318" },
  Returned: { background: "rgba(180,35,24,0.12)", color: "#b42318" },
  "Declared Free Agency": { background: "rgba(180,35,24,0.12)", color: "#b42318" },
  Retired: { background: "rgba(180,35,24,0.12)", color: "#b42318" },

  Signed: { background: "rgba(29,78,216,0.12)", color: "#1d4ed8" },
  "Signed as Free Agent": { background: "rgba(29,78,216,0.12)", color: "#1d4ed8" },
  Drafted: { background: "rgba(29,78,216,0.12)", color: "#1d4ed8" },
  "Claimed Off Waivers": { background: "rgba(29,78,216,0.12)", color: "#1d4ed8" },
};

const DEFAULT_TRANSACTION_COLOR: TransactionColor = {
  background: "rgba(15,31,61,0.06)",
  color: "var(--accent-soft)",
};

function transactionColor(typeDesc: string): TransactionColor {
  return TRANSACTION_COLORS[typeDesc] ?? DEFAULT_TRANSACTION_COLOR;
}

function TransactionDescription({
  description,
  people,
}: {
  description: string;
  people: TransactionPlayer[];
}) {
  const linkable = people.filter((person) => description.includes(person.fullName));

  if (linkable.length === 0) {
    return <p style={{ margin: 0, lineHeight: 1.5 }}>{description}</p>;
  }

  // Longest name first, so a name that's a substring of another (rare, but
  // possible with short nicknames) doesn't get split on incorrectly.
  const sorted = [...linkable].sort((a, b) => b.fullName.length - a.fullName.length);
  const nameToId = new Map(sorted.map((person) => [person.fullName, person.id]));
  const pattern = new RegExp(`(${sorted.map((person) => escapeRegExp(person.fullName)).join("|")})`, "g");

  const parts = description.split(pattern);

  return (
    <p style={{ margin: 0, lineHeight: 1.5 }}>
      {parts.map((part, index) => {
        const playerId = nameToId.get(part);

        if (playerId) {
          return (
            <Link key={index} href={`/players/${playerId}`} style={{ color: "var(--accent-soft)", fontWeight: 700 }}>
              {part}
            </Link>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

type TransactionsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const { page: pageParam } = await searchParams;
  const year = new Date().getFullYear();

  const transactions = await getSeasonTransactions(year);

  const requestedPage = Number.parseInt(pageParam ?? "1", 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage >= 1 ? requestedPage : 1;

  const totalPages = Math.max(1, Math.ceil(transactions.length / TRANSACTIONS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * TRANSACTIONS_PER_PAGE;
  const currentTransactions = transactions.slice(startIndex, startIndex + TRANSACTIONS_PER_PAGE);

  const hasNewer = safePage > 1;
  const hasOlder = safePage < totalPages;

  return (
    <div style={{ display: "grid", gap: "1.5rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Players</p>
        <h1 className="section-title">Transaction Log</h1>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        <h2 style={{ margin: "0 0 1rem" }}>{year} Season</h2>

        {transactions.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No transactions found for {year}.</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {currentTransactions.map((transaction) => (
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
                        background: transactionColor(transaction.typeDesc).background,
                        color: transactionColor(transaction.typeDesc).color,
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {transaction.typeDesc}
                    </span>
                  </div>

                  <TransactionDescription
                    description={transaction.description}
                    people={transaction.people}
                  />
                </article>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "1rem",
                marginTop: "2rem",
                flexWrap: "wrap",
              }}
            >
              {hasNewer ? (
                <Link
                  href={`?page=${safePage - 1}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.7rem 1.1rem",
                    border: "1px solid var(--line)",
                    borderRadius: "999px",
                    background: "var(--panel)",
                    color: "var(--text)",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  ← Newer
                </Link>
              ) : null}

              <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                Page {safePage} of {totalPages}
              </span>

              {hasOlder ? (
                <Link
                  href={`?page=${safePage + 1}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0.7rem 1.1rem",
                    border: "1px solid var(--line)",
                    borderRadius: "999px",
                    background: "var(--accent)",
                    color: "white",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Older →
                </Link>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
