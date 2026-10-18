import Link from "next/link";
import TeamLogo from "@/components/shared/TeamLogo";
import { CARDINALS_TEAM_ID, teamLogoUrl } from "@/lib/mlb";

// A compact strip above the podcasts while the Cardinals have no games
// (between the end of their season and spring training), pointing fans to
// the GM Simulator. Same red as the scoreboard it replaces.
export default function OffseasonBanner() {
  return (
    <article
      className="offseason-banner"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "18px",
        background: "linear-gradient(155deg, #c8253f 0%, #7d0f1f 100%)",
        color: "#fdfaf3",
        padding: "1.1rem 1.4rem",
        display: "flex",
        alignItems: "center",
        gap: "1rem 1.5rem",
        flexWrap: "wrap",
      }}
    >
      <TeamLogo
        src={teamLogoUrl(CARDINALS_TEAM_ID).replace("team-cap-on-light", "team-cap-on-dark")}
        alt=""
        style={{
          position: "absolute",
          right: "13rem",
          top: "50%",
          transform: "translateY(-50%)",
          width: "150px",
          height: "150px",
          opacity: 0.1,
          pointerEvents: "none",
        }}
      />
      <div style={{ display: "grid", gap: "0.3rem", flex: "1 1 360px", position: "relative" }}>
        <p className="kicker" style={{ margin: 0, color: "#f2c14e" }}>
          Cardinals Offseason
        </p>
        <h2 style={{ margin: 0, fontFamily: "Anton, sans-serif", fontSize: "1.8rem", letterSpacing: "0.02em", lineHeight: 1.05 }}>
          Welcome to the Offseason
        </h2>
        <p style={{ margin: 0, lineHeight: 1.45, color: "rgba(253,250,243,0.88)", maxWidth: "70ch" }}>
          No baseball until spring training — so take over the front office. Trade, sign free agents, extend players,
          and build your own Cardinals roster in the GM Simulator.
        </p>
      </div>
      <Link
        href="/gm-simulator"
        style={{
          position: "relative",
          padding: "0.65rem 1.2rem",
          borderRadius: "999px",
          border: "1.5px solid #f2c14e",
          background: "rgba(242,193,78,0.16)",
          color: "#ffe9a8",
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        Build a Cardinals roster →
      </Link>
    </article>
  );
}
