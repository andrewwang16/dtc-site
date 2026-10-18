import Link from "next/link";
import TeamLogo from "@/components/shared/TeamLogo";
import { CARDINALS_TEAM_ID, teamLogoUrl } from "@/lib/mlb";

// Stands in for the scoreboard when the Cardinals have no games (between
// the end of their season and spring training), pointing fans to the GM
// Simulator. Same red card as the scoreboard.
export default function OffseasonBanner() {
  return (
    <section>
      <article
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "18px",
          background: "linear-gradient(155deg, #c8253f 0%, #7d0f1f 100%)",
          color: "#fdfaf3",
          padding: "1.6rem 1.5rem",
          display: "grid",
          gap: "0.9rem",
          minHeight: "100%",
          alignContent: "center",
        }}
      >
        <TeamLogo
          src={teamLogoUrl(CARDINALS_TEAM_ID).replace("team-cap-on-light", "team-cap-on-dark")}
          alt=""
          style={{
            position: "absolute",
            right: "-1.5rem",
            bottom: "-1.5rem",
            width: "190px",
            height: "190px",
            opacity: 0.12,
            pointerEvents: "none",
          }}
        />
        <p className="kicker" style={{ margin: 0, color: "#f2c14e" }}>
          Cardinals Offseason
        </p>
        <h2 style={{ margin: 0, fontFamily: "Anton, sans-serif", fontSize: "2.2rem", letterSpacing: "0.02em", lineHeight: 1.05 }}>
          Welcome to the offseason
        </h2>
        <p style={{ margin: 0, maxWidth: "46ch", lineHeight: 1.5, color: "rgba(253,250,243,0.88)" }}>
          No baseball until spring training — so take over the front office. Trade, sign free agents, extend players,
          and build your own Cardinals roster for next season in the GM Simulator.
        </p>
        <Link
          href="/gm-simulator"
          style={{
            justifySelf: "start",
            marginTop: "0.3rem",
            padding: "0.65rem 1.2rem",
            borderRadius: "999px",
            border: "1.5px solid #f2c14e",
            background: "rgba(242,193,78,0.16)",
            color: "#ffe9a8",
            fontWeight: 800,
          }}
        >
          Build a Cardinals roster →
        </Link>
      </article>
    </section>
  );
}
