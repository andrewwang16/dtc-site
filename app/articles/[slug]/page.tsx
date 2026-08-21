import { notFound } from "next/navigation";
import Link from "next/link";
import { getArticleBySlug } from "@/lib/articles";

function formatArticleDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <div style={{ display: "grid", gap: "2.5rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up" style={{ maxWidth: "760px", margin: "0 auto" }}>
        <p className="kicker">Article</p>
        <h1 className="section-title">{article.title}</h1>

        <p style={{ marginTop: "0.75rem", color: "var(--muted)" }}>
          By {article.author} · {formatArticleDate(article.date)}
        </p>

        <div
          style={{
            marginTop: "1.5rem",
            borderRadius: "18px",
            overflow: "hidden",
            border: "1px solid var(--line)",
            aspectRatio: "16 / 9",
          }}
        >
          <img
            src={article.image}
            alt={article.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <div style={{ marginTop: "1.75rem", display: "grid", gap: "1.15rem" }}>
          {article.body.map((paragraph, index) => (
            <p key={index} style={{ margin: 0, lineHeight: 1.7, fontSize: "1.05rem" }}>
              {paragraph}
            </p>
          ))}
        </div>

        {article.playerId && article.playerName && (
          <Link
            href={`/players/${article.playerId}`}
            style={{
              marginTop: "2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "var(--panel)",
              padding: "1.15rem",
              color: "inherit",
            }}
          >
            <div>
              <p className="kicker" style={{ marginBottom: "0.3rem" }}>
                Player Profile
              </p>
              <p style={{ margin: 0, fontWeight: 800 }}>
                View {article.playerName}&apos;s full stats & bio
              </p>
            </div>
            <span style={{ fontSize: "1.3rem" }}>→</span>
          </Link>
        )}
      </section>
    </div>
  );
}
