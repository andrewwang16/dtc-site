import Link from "next/link";
import { playerHeadshotUrl } from "@/lib/mlb";
import { getDepthChart, type DepthChartGroup, type DepthChartPlayer } from "@/lib/depth-chart";

function StatusTag({ status }: { status?: string }) {
  if (!status || status === "Active") {
    return null;
  }

  const isInjured = status.startsWith("Injured");
  const label = isInjured ? "IL" : status === "Reassigned to Minors" ? "Minors" : status;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.1rem 0.45rem",
        borderRadius: "999px",
        fontSize: "0.65rem",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        background: isInjured ? "rgba(180,35,24,0.12)" : "rgba(15,31,61,0.08)",
        color: isInjured ? "#b42318" : "var(--muted)",
      }}
    >
      {label}
    </span>
  );
}

function PlayerChip({ player }: { player: DepthChartPlayer }) {
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
      <StatusTag status={player.status} />
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

function PitcherGroup({ title, players }: { title: string; players: DepthChartPlayer[] }) {
  return (
    <div>
      <p className="kicker" style={{ marginBottom: "0.6rem" }}>
        {title}
      </p>
      {players.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>No {title.toLowerCase()} data available.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
          {players.map((player) => (
            <PlayerChip key={player.id} player={player} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function DepthChartPage() {
  const year = new Date().getFullYear();
  const { positionGroups, starters, bullpen } = await getDepthChart(year);

  return (
    <div style={{ display: "grid", gap: "3rem", paddingBottom: "4rem", paddingTop: "2.2rem" }}>
      <section className="container fade-up">
        <p className="kicker">Players</p>
        <h1 className="section-title">Depth Chart</h1>
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

        {starters.length === 0 && bullpen.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Roster data isn&apos;t available right now.</p>
        ) : (
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "18px",
              background: "var(--panel)",
              padding: "1.15rem",
              display: "grid",
              gap: "1.15rem",
            }}
          >
            <PitcherGroup title="Starters" players={starters} />
            <PitcherGroup title="Bullpen" players={bullpen} />
          </div>
        )}
      </section>
    </div>
  );
}
