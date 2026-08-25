import Link from "next/link";
import { auth } from "@/auth";
import { getRecentArticles } from "@/lib/articles";
import { hasPremiumAccess } from "@/lib/access";
import { PremiumBadge } from "@/components/shared/PremiumLock";

function formatArticleDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export default async function LatestArticles() {
  const [articles, session] = await Promise.all([getRecentArticles(3), auth()]);

  if (articles.length === 0) {
    return null;
  }

  const hasAccess = hasPremiumAccess(session?.user);

  return (
    <section className="container fade-up" style={{ animationDelay: "0.04s" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <p className="kicker">Latest Articles</p>
          <h2 className="section-title">Fresh Off The Desk</h2>
        </div>

        <Link href="/articles" style={{ color: "var(--accent-soft)", fontWeight: 700 }}>
          View all articles
        </Link>
      </div>

      <div
        style={{
          marginTop: "1.2rem",
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
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{article.title}</h3>
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.55 }}>
                {article.excerpt}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
