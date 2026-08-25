import Link from "next/link";
import {
  computeRollingValue,
  formatRollingValue,
  getCardinalsRoster,
  getLeagueAverages,
  getPlayerYearStats,
  parseStatNumber,
  playerHeadshotUrl,
  type GameLogEntry,
  type LeagueAverages,
  type PlayerRole,
} from "@/lib/mlb";

const TRAILING_WINDOW_DAYS = 10;
const MIN_RECENT_GAMES = 2;
const MIN_SEASON_GAMES = 10;
const LIST_SIZE = 5;

type MoverEntry = {
  id: number;
  name: string;
  role: PlayerRole;
  recentValue: number;
  seasonValue: number;
  delta: number;
  recentGamesPlayed: number;
};

function isWithinTrailingWindow(dateString: string, cutoff: Date) {
  return new Date(`${dateString}T12:00:00Z`) >= cutoff;
}

async function buildMovers(year: number, league: LeagueAverages): Promise<{
  hitters: MoverEntry[];
  pitchers: MoverEntry[];
}> {
  const roster = await getCardinalsRoster(year, "active");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRAILING_WINDOW_DAYS);

  const entries = await Promise.all(
    roster.map(async (player): Promise<MoverEntry | null> => {
      const role: PlayerRole = player.position === "P" ? "Pitcher" : "Hitter";
      const group = role === "Pitcher" ? "pitching" : "hitting";
      const statKey = role === "Pitcher" ? "ERA" : "OPS";

      const yearStats = await getPlayerYearStats(player.id, year, group);

      const seasonGames =
        role === "Pitcher" ? yearStats.season?.gamesPitched : yearStats.season?.gamesPlayed;

      if (!yearStats.season || (seasonGames ?? 0) < MIN_SEASON_GAMES) {
        return null;
      }

      const recentGames: GameLogEntry[] = yearStats.gameLog.filter((game) =>
        isWithinTrailingWindow(game.date, cutoff)
      );

      if (recentGames.length < MIN_RECENT_GAMES) {
        return null;
      }

      const recentValue = computeRollingValue(recentGames, statKey, role, league);
      const seasonRaw =
        statKey === "ERA" ? yearStats.season.era : yearStats.season.ops;
      const seasonValue = parseStatNumber(seasonRaw);

      if (recentValue === null || !seasonValue) {
        return null;
      }

      const delta = role === "Pitcher" ? seasonValue - recentValue : recentValue - seasonValue;

      return {
        id: player.id,
        name: player.fullName,
        role,
        recentValue,
        seasonValue,
        delta,
        recentGamesPlayed: recentGames.length,
      };
    })
  );

  const valid = entries.filter((entry): entry is MoverEntry => entry !== null);

  return {
    hitters: valid.filter((entry) => entry.role === "Hitter"),
    pitchers: valid.filter((entry) => entry.role === "Pitcher"),
  };
}

function MoverList({
  title,
  description,
  entries,
  statKey,
  positive,
}: {
  title: string;
  description: string;
  entries: MoverEntry[];
  statKey: "OPS" | "ERA";
  positive: boolean;
}) {
  return (
    <article
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "1.15rem",
      }}
    >
      <p className="kicker" style={{ marginBottom: "0.35rem" }}>
        {description}
      </p>
      <h3 style={{ margin: "0 0 0.9rem" }}>{title}</h3>

      {entries.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>
          {positive
            ? "No one is trending up right now."
            : "No one is trending down right now."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/players/${entry.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.55rem 0.65rem",
                borderRadius: "12px",
                border: "1px solid var(--line)",
                background: "rgba(15,31,61,0.02)",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "rgba(15,31,61,.08)",
                  border: "1px solid var(--line)",
                }}
              >
                <img
                  src={playerHeadshotUrl(entry.id, 80)}
                  alt={entry.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center",
                  }}
                />
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{entry.name}</p>
                <p style={{ margin: "0.15rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                  Last {entry.recentGamesPlayed}G {statKey}: {formatRollingValue(statKey, entry.recentValue)}
                  {" · "}
                  Season: {formatRollingValue(statKey, entry.seasonValue)}
                </p>
              </div>

              <span
                style={{
                  fontWeight: 800,
                  color: positive ? "#0f7a38" : "#b42318",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.delta >= 0 ? "+" : ""}
                {entry.delta.toFixed(3).replace(/^(-?)0\./, "$1.")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function HotColdPage() {
  const year = new Date().getFullYear();
  const league = await getLeagueAverages(year);
  const { hitters, pitchers } = await buildMovers(year, league);

  const hotHitters = hitters
    .filter((entry) => entry.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, LIST_SIZE);
  const coldHitters = hitters
    .filter((entry) => entry.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, LIST_SIZE);
  const hotPitchers = pitchers
    .filter((entry) => entry.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, LIST_SIZE);
  const coldPitchers = pitchers
    .filter((entry) => entry.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, LIST_SIZE);

  return (
    <div
      style={{
        display: "grid",
        gap: "3rem",
        paddingBottom: "4rem",
        paddingTop: "2.2rem",
      }}
    >
      <section className="container fade-up" style={{ minWidth: 0 }}>
        <p className="kicker">Players · Trends</p>
        <h1 className="section-title">Trends</h1>
      </section>

      <section
        className="container fade-up"
        style={{
          animationDelay: "0.08s",
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          minWidth: 0,
        }}
      >
        <MoverList
          title="Hot Hitters"
          description="Biggest OPS risers"
          entries={hotHitters}
          statKey="OPS"
          positive
        />
        <MoverList
          title="Cold Hitters"
          description="Biggest OPS fallers"
          entries={coldHitters}
          statKey="OPS"
          positive={false}
        />
        <MoverList
          title="Hot Pitchers"
          description="Biggest ERA improvements"
          entries={hotPitchers}
          statKey="ERA"
          positive
        />
        <MoverList
          title="Cold Pitchers"
          description="Biggest ERA regressions"
          entries={coldPitchers}
          statKey="ERA"
          positive={false}
        />
      </section>
    </div>
  );
}
