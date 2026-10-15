export default function ArticlesPage() {
  return (
    <div style={{ display: "grid", gap: "1.25rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Articles</p>
        <h1 className="section-title">Articles Coming Soon</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          Written Cardinals coverage is on the way. In the meantime, catch our latest episodes on the
          podcast page.
        </p>
      </section>
    </div>
  );
}
