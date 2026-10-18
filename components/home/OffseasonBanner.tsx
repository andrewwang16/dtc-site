import Link from "next/link";
import TeamLogo from "@/components/shared/TeamLogo";
import { CARDINALS_TEAM_ID, teamLogoUrl } from "@/lib/mlb";

// Stands in for the scoreboard when the Cardinals have no games (between
// the end of their season and spring training), pointing fans to the GM
// Simulator. Same red card as the scoreboard.
export default function OffseasonBanner() {
  return (
    <section style={{ height: "100%" }}>
      <article
        className="offseason-banner"
        style={{
          height: "100%",
          boxSizing: "border-box",
          position: "relative",
          overflow: "hidden",
          borderRadius: "18px",
          background: "linear-gradient(155deg, #c8253f 0%, #7d0f1f 100%)",
          color: "#fdfaf3",
          padding: "2rem 1.8rem",
          display: "grid",
          gap: "1rem",
          alignContent: "center",
        }}
      >
        <TeamLogo
          src={teamLogoUrl(CARDINALS_TEAM_ID).replace("team-cap-on-light", "team-cap-on-dark")}
          alt=""
          style={{
            position: "absolute",
            right: "-2rem",
            bottom: "-2rem",
            width: "300px",
            height: "300px",
            opacity: 0.12,
            pointerEvents: "none",
          }}
        />
        <p className="kicker" style={{ margin: 0, color: "#f2c14e" }}>
          Cardinals Offseason
        </p>
        <h2 style={{ margin: 0, fontFamily: "Anton, sans-serif", fontSize: "2.6rem", letterSpacing: "0.02em", lineHeight: 1.05 }}>
          Welcome to the Offseason
        </h2>
        <p style={{ margin: 0, maxWidth: "46ch", lineHeight: 1.5, color: "rgba(253,250,243,0.88)" }}>
          No baseball until spring training — so take over the front office. Trade, sign free agents, extend players,
          and build your own Cardinals roster for next season in the GM Simulator.
        </p>
        <ul
          style={{
            listStyle: "none",
            margin: "0.2rem 0 0",
            padding: 0,
            display: "grid",
            gap: "0.55rem",
            maxWidth: "44ch",
            position: "relative",
          }}
        >
          {[
            ["Trade", "Deal with any club — players, prospects and cash"],
            ["Sign", "Bid on this winter's free agents, with deferrals"],
            ["Extend", "Lock up the core before arbitration"],
            ["Set the 26-man", "Lineup, rotation, bullpen roles, then download your roster graphic"],
          ].map(([title, text]) => (
            <li key={title} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.6rem", alignItems: "baseline" }}>
              <span style={{ color: "#f2c14e", fontWeight: 800 }}>{title}</span>
              <span style={{ color: "rgba(253,250,243,0.85)", fontSize: "0.92rem" }}>{text}</span>
            </li>
          ))}
        </ul>
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
