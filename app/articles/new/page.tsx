import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/require-admin";
import ArticleEditor from "@/components/articles/ArticleEditor";

export default async function NewArticlePage() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/articles");
  }

  return (
    <div style={{ display: "grid", gap: "2rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up" style={{ maxWidth: "760px", margin: "0 auto", width: "100%" }}>
        <p className="kicker">Articles</p>
        <h1 className="section-title">Write Article</h1>

        <div style={{ marginTop: "1.5rem" }}>
          <ArticleEditor />
        </div>
      </section>
    </div>
  );
}
