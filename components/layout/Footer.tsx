const links = [
  { label: "YouTube", href: "https://www.youtube.com" },
  { label: "Spotify", href: "https://open.spotify.com" },
  { label: "Apple Podcasts", href: "https://podcasts.apple.com" },
  { label: "Instagram", href: "https://www.instagram.com/DealinTheCards" },
];

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: "5rem",
        borderTop: "1px solid rgba(15,31,61, 0.28)",
        background: "var(--bg-soft)",
      }}
    >
      <div className="container" style={{ padding: "2.1rem 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <img
            src="/images/logo.png"
            alt=""
            width={32}
            height={32}
            style={{ display: "block" }}
          />
          <h3 style={{ margin: 0, fontFamily: "Anton, sans-serif", letterSpacing: "0.04em", fontSize: "1.3rem" }}>
            Dealin&apos; the Cards Media
          </h3>
        </div>
        <p style={{ marginTop: "0.45rem", color: "var(--muted)", maxWidth: "45rem" }}>
          Independent St. Louis sports media network focused on Cardinals coverage, prospect analysis, documentaries,
          interviews, and community-first discussion.
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.65rem", color: "var(--text)" }}>
          {links.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
