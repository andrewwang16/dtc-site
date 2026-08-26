import Link from "next/link";
import PlayerSearch from "@/components/players/PlayerSearch";
import DepthChartView from "@/components/roster/DepthChartView";
import { getCardinalsRoster, playerHeadshotUrl, type RosterEntry, type RosterType } from "@/lib/mlb";
import { getDepthChart } from "@/lib/depth-chart";

const TABS: Array<{ slug: string; label: string; rosterType?: RosterType }> = [
  { slug: "26man", label: "26-Man Roster", rosterType: "active" },
  { slug: "40man", label: "40-Man Roster", rosterType: "40Man" },
  { slug: "depth", label: "Depth Chart" },
];

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

type RosterPageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function RosterPage({ searchParams }: RosterPageProps) {
  const { type } = await searchParams;
  const activeTab = TABS.find((tab) => tab.slug === type) ?? TABS[0];

  const year = new Date().getFullYear();
  const isDepthTab = activeTab.slug === "depth";

  const [roster, searchRoster, depthChart] = await Promise.all([
    isDepthTab ? Promise.resolve([]) : getCardinalsRoster(year, activeTab.rosterType),
    getCardinalsRoster(year),
    isDepthTab ? getDepthChart(year) : Promise.resolve(null),
  ]);
  const groups = groupRoster(roster);

  return (
    <div
      style={{
        display: "grid",
        gap: "1.5rem",
        paddingBottom: "4rem",
        paddingTop: "2.2rem",
      }}
    >
      <section className="container fade-up">
        <p className="kicker">Players</p>
        <h1 className="section-title">Cardinals Roster</h1>
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.04s" }}>
        <PlayerSearch roster={searchRoster} />
      </section>

      <section className="container fade-up" style={{ animationDelay: "0.06s" }}>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          {TABS.map((tab) => {
            const isActive = tab.slug === activeTab.slug;

            return (
              <a
                key={tab.slug}
                href={`/roster?type=${tab.slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.6rem 1.1rem",
                  borderRadius: "999px",
                  border: `1px solid ${isActive ? "#8a1024" : "var(--line)"}`,
                  background: isActive
                    ? "rgba(196,30,58,0.18)"
                    : "rgba(15,31,61,0.02)",
                  color: "var(--text)",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
      </section>

      {isDepthTab && depthChart ? (
        <DepthChartView {...depthChart} />
      ) : groups.length === 0 ? (
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
