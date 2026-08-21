import FeaturedGrid from "../../components/home/FeaturedGrid";
import LatestArticles from "../../components/home/LatestArticles";

export default function ArticlesPage() {
  return (
    <div style={{ display: "grid", gap: "5.5rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Articles</p>
        <h1 className="section-title">Coming Soon</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "64ch" }}>
        </p>

        
      </section>
    </div>
  );
}