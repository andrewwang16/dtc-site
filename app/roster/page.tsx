import Link from "next/link";
import PlayerSearch from "@/components/players/PlayerSearch";
import { getCardinalsRoster, playerHeadshotUrl, type RosterEntry } from "@/lib/mlb";

const POSITION_GROUPS = [
  { label: "Pitchers", positions: new Set(["P", "SP", "RP"]) },
  { label: "Catchers", positions: new Set(["C"]) },
  { label: "Infielders", positions: new Set(["1B", "2B", "3B", "SS", "IF"]) },
  { label: "Outfielders", positions: new Set(["LF", "CF", "RF", "OF"]) },
  { label: "Designated Hitters", positions: new Set(["DH"]) },
  { label: "Two-Way Players", positions: new Set(["TWP"]) },
];

const STATUS_LABELS: Record<string, string> = {
  "Reassigned to Minors": "Minors",
};

function formatRosterStatus(status: string) {
  return STATUS_LABELS[status] ?? status;
}

const NAME_SUFFIXES = new Set(["Jr.", "Jr", "Sr.", "Sr", "II", "III", "IV", "V"]);

function getLastName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  let lastIndex = parts.length - 1;

  while (lastIndex > 0 && NAME_SUFFIXES.has(parts[lastIndex])) {
    lastIndex -= 1;
  }

  return parts[lastIndex] ?? fullName;
}

function groupRoster(roster: RosterEntry[]) {
  const groups = POSITION_GROUPS.map((group) => ({
    label: group.label,
    players: roster.filter((player) => group.positions.has(player.position)),
  }));

  const groupedIds = new Set(groups.flatMap((group) => group.players.map((player) => player.id)));
  const remaining = roster.filter((player) => !groupedIds.has(player.id));

  if (remaining.length > 0) {
    groups.push({ label: "Other", players: remaining });
  }

  for (const group of groups) {
    group.players.sort((a, b) => getLastName(a.fullName).localeCompare(getLastName(b.fullName)));
  }

  return groups.filter((group) => group.players.length > 0);
}

export default async function RosterPage() {
  const year = new Date().getFullYear();
  const roster = await getCardinalsRoster(year, "40Man");
  const groups = groupRoster(roster);

  return (
    <div
      style={{
        display: "grid",
        gap: "3rem",
        paddingBottom: "4rem",
        paddingTop: "2.2rem",
      }}
    >
      <section className="container fade-up">
        <p className="kicker">Players</p>
        <h1 className="section-title">Cardinals Roster</h1>
        <p
          style={{
            marginTop: "0.9rem",
            color: "var(--muted)",
            maxWidth: "62ch",
          }}
        >
          The full 40-man roster, grouped by position. Click a player for bio info, season stats, splits, and a game log.
        </p>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.04s" }}>
        <PlayerSearch roster={roster} />
      </section>

      {groups.length === 0 ? (
        <section className="container fade-up" style={{ animationDelay: "0.08s" }}>
          <p style={{ color: "var(--muted)" }}>No roster data available for {year}.</p>
        </section>
      ) : (
        groups.map((group, index) => (
          <section
            key={group.label}
            className="container fade-up"
            style={{ animationDelay: `${0.08 + index * 0.04}s` }}
          >
            <h2 style={{ margin: "0 0 1rem" }}>{group.label}</h2>

            <div
              style={{
                display: "grid",
                gap: "0.5rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              {group.players.map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.85rem",
                    border: "1px solid var(--line)",
                    borderRadius: "18px",
                    background: "var(--panel)",
                    padding: "0.85rem",
                    color: "var(--text)",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "80px",
                      borderRadius: "14px",
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "rgba(15,31,61,.08)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <img
                      src={playerHeadshotUrl(player.id, 128)}
                      alt={player.fullName}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center",
                      }}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <p className="kicker" style={{ marginBottom: "0.25rem" }}>
                      {player.position}
                      {player.jerseyNumber ? ` · #${player.jerseyNumber}` : ""}
                    </p>
                    <p style={{ margin: 0, fontWeight: 700 }}>{player.fullName}</p>
                    {player.status && player.status !== "Active" ? (
                      <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                        {formatRosterStatus(player.status)}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
