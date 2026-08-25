import Link from "next/link";
import { playerHeadshotUrl, type RosterEntry } from "@/lib/mlb";
import { getDepthChart, type DepthChartGroup } from "@/lib/depth-chart";

function PlayerChip({ player }: { player: RosterEntry }) {
  return (
    <Link
      href={`/players/${player.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.55rem",
        padding: "0.35rem 0.8rem 0.35rem 0.35rem",
        borderRadius: "999px",
        border: "1px solid var(--line)",
        background: "rgba(15,31,61,0.02)",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <div
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: "rgba(15,31,61,.08)",
          border: "1px solid var(--line)",
        }}
      >
        <img
          src={playerHeadshotUrl(player.id, 60)}
          alt={player.fullName}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
        />
      </div>
      <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{player.fullName}</span>
    </Link>
  );
}

function PositionRow({ group, isLast }: { group: DepthChartGroup; isLast: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px 1fr",
        gap: "1rem",
        alignItems: "start",
        paddingBottom: isLast ? 0 : "1rem",
        marginBottom: isLast ? 0 : "1rem",
        borderBottom: isLast ? "none" : "1px solid var(--line)",
      }}
    >
      <p className="kicker" style={{ margin: 0, paddingTop: "0.4rem" }}>
        {group.position}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {group.players.map((player) => (
          <PlayerChip key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}

export default async function DepthChartPage() {
  const year = new Date().getFullYear();
  const { positionGroups, pitchers } = await getDepthChart(year);

  return (
    <div style={{ display: "grid", gap: "3rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Players</p>
        <h1 className="section-title">Depth Chart</h1>
        <p style={{ marginTop: "0.9rem", color: "var(--muted)", maxWidth: "62ch" }}>
          The 40-man roster grouped by position. Players within each spot are listed
          alphabetically for now — true depth order is a planned improvement.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        <h2 style={{ margin: "0 0 1rem" }}>Position Players</h2>

        {positionGroups.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Roster data isn&apos;t available right now.</p>
        ) : (
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "var(--panel)",
              padding: "1.15rem",
            }}
          >
            {positionGroups.map((group, index) => (
              <PositionRow
                key={group.position}
                group={group}
                isLast={index === positionGroups.length - 1}
              />
            ))}
          </div>
        )}
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.1s" }}>
        <h2 style={{ margin: "0 0 1rem" }}>Pitching Staff</h2>

        {pitchers.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Roster data isn&apos;t available right now.</p>
        ) : (
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "var(--panel)",
              padding: "1.15rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.6rem",
            }}
          >
            {pitchers.map((player) => (
              <PlayerChip key={player.id} player={player} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
