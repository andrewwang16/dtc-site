import { auth } from "@/auth";

export default async function WelcomeBanner() {
  const session = await auth();
  const user = session?.user;
  const displayName = user ? user.name ?? user.email ?? "there" : null;

  return (
    <section className="container fade-up">
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "1.5rem",
        }}
      >
        <h1 className="section-title" style={{ fontSize: "1.7rem" }}>
          {displayName ? `Welcome ${displayName}!` : "Welcome to Dealin' the Cards"}
        </h1>
        <p style={{ marginTop: "0.75rem", color: "var(--muted)", lineHeight: 1.6, maxWidth: "72ch" }}>
          Dealin&apos; the Cards is your one stop shop for St. Louis Cardinals content. Find our podcasts and
          the latest information you need about Cardinals stats, news, rumors, and prospects!
        </p>
      </div>
    </section>
  );
}
