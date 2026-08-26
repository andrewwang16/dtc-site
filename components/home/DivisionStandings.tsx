import {
  CARDINALS_TEAM_ID,
  getDivisionStandings,
  getWildCardStandings,
  teamLogoUrl,
  type TeamStanding,
} from "@/lib/mlb";
import TeamLogo from "@/components/shared/TeamLogo";

const STANDINGS_TABLE_MAX_HEIGHT = "230px";

function StandingsTable({
  title,
  standings,
  wildCardCutoff,
}: {
  title: string;
  standings: TeamStanding[];
  wildCardCutoff?: number;
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
      <p className="kicker" style={{ marginBottom: "0.75rem" }}>
        {title}
      </p>

      {standings.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Standings are not available right now.
        </p>
      ) : (
        <div
          className={wildCardCutoff !== undefined ? "wildcard-standings-scroll" : undefined}
          style={{
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: STANDINGS_TABLE_MAX_HEIGHT,
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "360px" }}>
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  color: "var(--muted)",
                  fontSize: "0.8rem",
                  position: "sticky",
                  top: 0,
                  background: "var(--panel)",
                }}
              >
                <th style={{ padding: "0.35rem 0.5rem" }}>#</th>
                <th style={{ padding: "0.35rem 0.5rem" }}>Team</th>
                <th style={{ padding: "0.35rem 0.5rem", textAlign: "center" }}>W</th>
                <th style={{ padding: "0.35rem 0.5rem", textAlign: "center" }}>L</th>
                <th style={{ padding: "0.35rem 0.5rem", textAlign: "center" }}>PCT</th>
                <th style={{ padding: "0.35rem 0.5rem", textAlign: "center" }}>GB</th>
                <th style={{ padding: "0.35rem 0.5rem", textAlign: "center" }}>Streak</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => {
                const isCardinals = team.teamId === CARDINALS_TEAM_ID;
                const isAfterCutoff =
                  wildCardCutoff !== undefined && index === wildCardCutoff;

                return (
                  <tr
                    key={team.teamId}
                    style={{
                      borderTop: isAfterCutoff
                        ? "2px dashed rgba(15,31,61,.3)"
                        : "1px solid var(--line)",
                      background: isCardinals
                        ? "rgba(196,30,58,0.14)"
                        : "transparent",
                      fontWeight: isCardinals ? 800 : 400,
                    }}
                  >
                    <td style={{ padding: "0.45rem 0.5rem", color: "var(--muted)" }}>
                      {team.rank ?? index + 1}
                    </td>
                    <td style={{ padding: "0.45rem 0.5rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                        <TeamLogo
                          src={teamLogoUrl(team.teamId)}
                          alt=""
                          style={{ width: 20, height: 20 }}
                        />
                        {team.teamName}
                      </div>
                    </td>
                    <td style={{ padding: "0.45rem 0.5rem", textAlign: "center" }}>
                      {team.wins}
                    </td>
                    <td style={{ padding: "0.45rem 0.5rem", textAlign: "center" }}>
                      {team.losses}
                    </td>
                    <td style={{ padding: "0.45rem 0.5rem", textAlign: "center" }}>
                      {team.winningPercentage}
                    </td>
                    <td style={{ padding: "0.45rem 0.5rem", textAlign: "center" }}>
                      {team.gamesBack}
                    </td>
                    <td style={{ padding: "0.45rem 0.5rem", textAlign: "center" }}>
                      {team.streak ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export default async function DivisionStandings() {
  const year = new Date().getFullYear();

  const [divisionStandings, wildCardStandings] = await Promise.all([
    getDivisionStandings(year),
    getWildCardStandings(year),
  ]);

  return (
    <section className="container fade-up">
      <p className="kicker">Standings</p>

      <div
        style={{
          marginTop: "1.2rem",
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        }}
      >
        <StandingsTable title="NL Central" standings={divisionStandings} />
        <StandingsTable
          title="NL Wild Card"
          standings={wildCardStandings}
          wildCardCutoff={3}
        />
      </div>
    </section>
  );
}
