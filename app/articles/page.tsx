import Link from "next/link";
import { auth } from "@/auth";
import { getAllArticles } from "@/lib/articles";
import { hasPremiumAccess } from "@/lib/access";
import { PremiumBadge } from "@/components/shared/PremiumLock";

function formatArticleDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export default async function ArticlesPage() {
  const [articles, session] = await Promise.all([getAllArticles(), auth()]);
  const isAdmin = Boolean(session?.user?.isAdmin);
  const hasAccess = hasPremiumAccess(session?.user);

  return (
    <div style={{ display: "grid", gap: "5.5rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <p className="kicker">Articles</p>
            <h1 className="section-title">Cardinals Coverage</h1>
          </div>

          {isAdmin && (
            <Link
              href="/articles/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.6rem 1.1rem",
                borderRadius: "999px",
                border: "1px solid #8a1024",
                background: "rgba(196,30,58,0.18)",
                color: "var(--text)",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              + Write Article
            </Link>
          )}
        </div>

        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "64ch" }}>
          Original writing from the Dealin&apos; the Cards team on the Cardinals roster, prospects, and the season as it unfolds.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.08s" }}>
        {articles.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No articles published yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "1.25rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                style={{
                  display: "grid",
                  border: "1px solid var(--line)",
                  borderRadius: "18px",
                  background: "var(--panel)",
                  overflow: "hidden",
                  color: "inherit",
                }}
              >
                <div style={{ padding: "1.15rem", display: "grid", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem" }}>
                    <p className="kicker" style={{ margin: 0 }}>
                      {formatArticleDate(article.date)} · {article.author}
                    </p>
                    {article.isPremium && !hasAccess && <PremiumBadge />}
                  </div>
                  <h2 style={{ margin: 0, fontSize: "1.15rem" }}>{article.title}</h2>
                  <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>
                    {article.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
