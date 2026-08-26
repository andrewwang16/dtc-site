export default function ShopPage() {
  return (
    <div style={{ display: "grid", gap: "1.25rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Shop</p>
        <h1 className="section-title">Dealin&apos; the Cards Merch</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          Official Dealin&apos; the Cards gear, powered by Spring.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        <iframe
          style={{ borderRadius: "24px", border: "none", display: "block" }}
          src="https://embed.creator-spring.com/widget?slug=dealin-the-cards&per=20&currency=&page=1&layout=grid-sm-4&theme=light"
          title="Dealin' the Cards Merch store powered by Spring"
          width="100%"
          height={960}
        />
      </section>
    </div>
  );
}
