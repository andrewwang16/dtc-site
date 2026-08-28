import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/require-admin";
import { getArticleBySlug } from "@/lib/articles";
import { getCardinalsRoster } from "@/lib/mlb";
import ArticleEditor from "@/components/articles/ArticleEditor";

type EditArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/articles");
  }

  const { slug } = await params;

  const [article, roster] = await Promise.all([
    getArticleBySlug(slug),
    getCardinalsRoster(new Date().getFullYear()),
  ]);

  if (!article) {
    notFound();
  }

  return (
    <div style={{ display: "grid", gap: "1rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up" style={{ maxWidth: "760px", margin: "0 auto", width: "100%" }}>
        <p className="kicker">Articles</p>
        <h1 className="section-title">Edit Article</h1>

        <div style={{ marginTop: "1.5rem" }}>
          <ArticleEditor roster={roster} initialArticle={article} />
        </div>
      </section>
    </div>
  );
}
