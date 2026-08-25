import Link from "next/link";
import { auth } from "@/auth";
import { hasPremiumAccess } from "@/lib/access";

const GOLD = "#d4af37";

function SubscribeButton() {
  return (
    <Link
      href="/subscribe"
      style={{
        display: "inline-flex",
        alignItems: "center",
        marginTop: "1rem",
        padding: "0.65rem 1.4rem",
        borderRadius: "999px",
        border: `1px solid ${GOLD}`,
        background: GOLD,
        color: "#1a1a1a",
        fontWeight: 800,
        textDecoration: "none",
      }}
    >
      Subscribe
    </Link>
  );
}

export default async function WelcomeBanner() {
  const session = await auth();
  const user = session?.user;
  const isPremium = hasPremiumAccess(user);

  let heading: string;
  let body: React.ReactNode;
  let showSubscribeButton = false;

  if (!user) {
    heading = "Welcome to Dealin' the Cards";
    body = (
      <>
        Dealin&apos; the Cards is your one stop shop for St. Louis Cardinals content. Find our
        articles, podcasts, and the latest information you need about Cardinals stats, news,
        rumors, and prospects! Become a premium subscriber today! Check out{" "}
        <a
          href="https://cardinalsprospects.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent-soft)", fontWeight: 700 }}
        >
          cardinalsprospects.com
        </a>{" "}
        for premier coverage of the Cardinals&apos; farm system.
      </>
    );
    showSubscribeButton = true;
  } else {
    const displayName = user.name ?? user.email ?? "there";
    heading = `Welcome ${displayName}!`;

    if (isPremium) {
      body = "Thank you for your support of Dealin' the Cards! Please enjoy our Cardinals coverage!";
    } else {
      body = "Become a premium subscriber today to gain full access to all our content!";
      showSubscribeButton = true;
    }
  }

  return (
    <section className="container fade-up">
      <div
        style={{
          border: `1px solid ${isPremium ? GOLD : "var(--line)"}`,
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "1.5rem",
        }}
      >
        <h1 className="section-title" style={{ fontSize: "1.7rem" }}>
          {heading}
        </h1>
        <p style={{ marginTop: "0.75rem", color: "var(--muted)", lineHeight: 1.6, maxWidth: "72ch" }}>
          {body}
        </p>
        {showSubscribeButton && <SubscribeButton />}
      </div>
    </section>
  );
}
