"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  formatGameDate,
  formatGameTime,
  getHomeAwayLabel,
  getStatusLabel,
  getTeamLogoUrl,
  isPostponed,
  type MlbGame,
} from "./scheduleUtils";

type BoxPlayer = {
  person: { id: number; fullName: string };
  position?: { abbreviation: string };
  battingOrder?: string;
  stats: {
    batting?: {
      atBats?: number;
      runs?: number;
      hits?: number;
      rbi?: number;
      baseOnBalls?: number;
      strikeOuts?: number;
    };
    pitching?: {
      note?: string;
      inningsPitched?: string;
      hits?: number;
      runs?: number;
      earnedRuns?: number;
      baseOnBalls?: number;
      strikeOuts?: number;
    };
  };
};

type BoxTeam = {
  team: { id: number; name: string };
  batters: number[];
  pitchers: number[];
  players: Record<string, BoxPlayer>;
};

type FeedLiveResponse = {
  liveData: {
    linescore: {
      innings: Array<{
        num: number;
        away?: { runs?: number };
        home?: { runs?: number };
      }>;
      teams: {
        away: { runs?: number; hits?: number; errors?: number };
        home: { runs?: number; hits?: number; errors?: number };
      };
    };
    boxscore: {
      teams: {
        away: BoxTeam;
        home: BoxTeam;
      };
    };
  };
};

function getLastName(fullName?: string) {
  if (!fullName) {
    return "-";
  }

  const parts = fullName.trim().split(/\s+/);

  return parts[parts.length - 1];
}

function PlayerNameLink({ id, name }: { id?: number; name?: string }) {
  if (!id || !name) {
    return <span>{name ?? "-"}</span>;
  }

  return (
    <Link href={`/players/${id}`} style={{ color: "inherit", fontWeight: 700 }}>
      {name}
    </Link>
  );
}

function getBattingSlot(battingOrder: string) {
  return Math.floor(Number(battingOrder) / 100);
}

function teamAbbreviation(team: { name: string; teamName?: string; abbreviation?: string }) {
  return team.abbreviation ?? team.teamName ?? team.name;
}

function parseDecisionCode(note?: string) {
  if (!note) {
    return null;
  }

  const match = note.match(/\(([A-Za-z]+)/);

  return match ? match[1] : null;
}

const DECISION_LABELS: Record<string, string> = {
  W: "Win",
  L: "Loss",
  S: "Save",
  H: "Hold",
  BS: "Blown Save",
};

function DecisionBadge({ note }: { note?: string }) {
  const code = parseDecisionCode(note);

  if (!code) {
    return null;
  }

  const isPositive = code === "W" || code === "S" || code === "H";

  return (
    <span
      title={DECISION_LABELS[code] ?? code}
      style={{
        marginLeft: "0.3rem",
        fontSize: "0.6rem",
        fontWeight: 800,
        padding: "0.05rem 0.3rem",
        borderRadius: "999px",
        color: isPositive ? "#0f7a38" : "#b42318",
        background: isPositive ? "rgba(15,122,56,0.12)" : "rgba(180,35,24,0.12)",
      }}
    >
      {code}
    </span>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "0.22rem 0.25rem",
  textAlign: "center",
};

function TeamBoxScore({ label, team }: { label: string; team: BoxTeam }) {
  const battersSorted = team.batters
    .map((id) => team.players[`ID${id}`])
    .filter((player): player is BoxPlayer => Boolean(player?.battingOrder))
    .sort((a, b) => Number(a.battingOrder) - Number(b.battingOrder));

  const slotPrevious = new Map<number, BoxPlayer>();
  const batters = battersSorted.map((player) => {
    const slot = getBattingSlot(player.battingOrder!);
    const previous = slotPrevious.get(slot);
    slotPrevious.set(slot, player);

    const isStarter = Number(player.battingOrder) % 100 === 0;
    const isPinchHitter = player.position?.abbreviation === "PH";

    let subNote: string | null = null;
    if (!isStarter && previous) {
      subNote = isPinchHitter
        ? `PH for ${getLastName(previous.person.fullName)}`
        : `In for ${getLastName(previous.person.fullName)}`;
    }

    return { player, slot, isStarter, subNote };
  });

  const pitchers = team.pitchers
    .map((id) => team.players[`ID${id}`])
    .filter((player): player is BoxPlayer => Boolean(player));

  return (
    <div style={{ display: "grid", gap: "0.6rem", minWidth: 0 }}>
      <h3 style={{ margin: 0, fontSize: "0.95rem" }}>{label}</h3>

      {batters.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: "0.66rem",
          }}
        >
          <colgroup>
            <col style={{ width: "6%" }} />
            <col style={{ width: "27%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: "center", color: "var(--muted)" }}>
              <th style={cellStyle} aria-label="Batting order" />
              <th style={{ ...cellStyle, textAlign: "left" }}>Batting</th>
              <th style={cellStyle}>Pos</th>
              <th style={cellStyle}>AB</th>
              <th style={cellStyle}>R</th>
              <th style={cellStyle}>H</th>
              <th style={cellStyle}>RBI</th>
              <th style={cellStyle}>BB</th>
              <th style={cellStyle}>SO</th>
            </tr>
          </thead>
          <tbody>
            {batters.map(({ player, slot, isStarter, subNote }) => (
              <tr key={player.person.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ ...cellStyle, color: "var(--muted)" }}>{isStarter ? slot : "-"}</td>
                <td style={{ ...cellStyle, textAlign: "left", wordBreak: "break-word" }}>
                  <PlayerNameLink id={player.person.id} name={player.person.fullName} />
                  {subNote && (
                    <div style={{ color: "var(--muted)", fontSize: "0.58rem", fontWeight: 400 }}>
                      {subNote}
                    </div>
                  )}
                </td>
                <td style={cellStyle}>{player.position?.abbreviation ?? "-"}</td>
                <td style={cellStyle}>{player.stats.batting?.atBats ?? 0}</td>
                <td style={cellStyle}>{player.stats.batting?.runs ?? 0}</td>
                <td style={cellStyle}>{player.stats.batting?.hits ?? 0}</td>
                <td style={cellStyle}>{player.stats.batting?.rbi ?? 0}</td>
                <td style={cellStyle}>{player.stats.batting?.baseOnBalls ?? 0}</td>
                <td style={cellStyle}>{player.stats.batting?.strikeOuts ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pitchers.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: "0.66rem",
          }}
        >
          <colgroup>
            <col style={{ width: "38%" }} />
            <col style={{ width: "10.33%" }} />
            <col style={{ width: "10.33%" }} />
            <col style={{ width: "10.33%" }} />
            <col style={{ width: "10.33%" }} />
            <col style={{ width: "10.33%" }} />
            <col style={{ width: "10.33%" }} />
          </colgroup>
          <thead>
            <tr style={{ textAlign: "center", color: "var(--muted)" }}>
              <th style={{ ...cellStyle, textAlign: "left" }}>Pitching</th>
              <th style={cellStyle}>IP</th>
              <th style={cellStyle}>H</th>
              <th style={cellStyle}>R</th>
              <th style={cellStyle}>ER</th>
              <th style={cellStyle}>BB</th>
              <th style={cellStyle}>K</th>
            </tr>
          </thead>
          <tbody>
            {pitchers.map((player) => (
              <tr key={player.person.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ ...cellStyle, textAlign: "left", wordBreak: "break-word" }}>
                  <PlayerNameLink id={player.person.id} name={player.person.fullName} />
                  <DecisionBadge note={player.stats.pitching?.note} />
                </td>
                <td style={cellStyle}>{player.stats.pitching?.inningsPitched ?? "-"}</td>
                <td style={cellStyle}>{player.stats.pitching?.hits ?? 0}</td>
                <td style={cellStyle}>{player.stats.pitching?.runs ?? 0}</td>
                <td style={cellStyle}>{player.stats.pitching?.earnedRuns ?? 0}</td>
                <td style={cellStyle}>{player.stats.pitching?.baseOnBalls ?? 0}</td>
                <td style={cellStyle}>{player.stats.pitching?.strikeOuts ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function GameDetailModal({
  game,
  onClose,
}: {
  game: MlbGame;
  onClose: () => void;
}) {
  const [feed, setFeed] = useState<FeedLiveResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeTeam, setActiveTeam] = useState<"away" | "home">("away");

  const postponed = isPostponed(game);
  const isPreview = game.status.abstractGameState === "Preview";

  useEffect(() => {
    if (isPreview || postponed) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetch(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Request failed");
        }

        return response.json();
      })
      .then((data: FeedLiveResponse) => {
        if (!cancelled) {
          setFeed(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [game.gamePk, isPreview, postponed]);

  const innings = feed?.liveData?.linescore?.innings ?? [];
  const lineTeams = feed?.liveData?.linescore?.teams;

  const teamColWidth = 34;
  const statColWidth = 8;
  const inningColWidth =
    innings.length > 0 ? (100 - teamColWidth - statColWidth * 3) / innings.length : 0;

  const hasWideScore = [
    lineTeams?.away.runs,
    lineTeams?.home.runs,
    lineTeams?.away.hits,
    lineTeams?.home.hits,
    lineTeams?.away.errors,
    lineTeams?.home.errors,
  ].some((value) => (value ?? 0) >= 10);

  const scoreCellStyle: React.CSSProperties = hasWideScore
    ? { ...cellStyle, fontSize: "0.62rem" }
    : cellStyle;

  return createPortal(
    <div
      onClick={onClose}
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 4, 6, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        zIndex: 100,
        color: "var(--text)",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="modal-dialog"
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "88vh",
          overflowY: "auto",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "1.5rem",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            width: "2rem",
            height: "2rem",
            borderRadius: "999px",
            border: "1px solid var(--line)",
            background: "var(--bg-soft)",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "1rem",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <p className="kicker" style={{ marginBottom: "0.35rem" }}>
          {formatGameDate(game.gameDate)}
        </p>

        <h2 style={{ margin: "0 0 0.5rem" }}>
          {game.teams.away.team.teamName ?? game.teams.away.team.name} @{" "}
          {game.teams.home.team.teamName ?? game.teams.home.team.name}
        </h2>

        <p style={{ marginTop: "0.5rem", color: "var(--muted)" }}>
          {getHomeAwayLabel(game)} · {formatGameTime(game.gameDate)} · {getStatusLabel(game)} · {game.venue?.name ?? "TBD"}
        </p>

        {postponed ? (
          <p style={{ marginTop: "1.25rem", color: "var(--muted)" }}>This game was postponed.</p>
        ) : isPreview ? (
          <div style={{ marginTop: "1.25rem" }}>
            <p className="kicker" style={{ marginBottom: "0.35rem" }}>
              Probable Pitchers
            </p>
            <p style={{ margin: 0 }}>
              <PlayerNameLink
                id={game.teams.away.probablePitcher?.id}
                name={game.teams.away.probablePitcher?.fullName ?? "TBD"}
              />
              {" vs "}
              <PlayerNameLink
                id={game.teams.home.probablePitcher?.id}
                name={game.teams.home.probablePitcher?.fullName ?? "TBD"}
              />
            </p>
            <p style={{ marginTop: "0.75rem", color: "var(--muted)" }}>
              A box score will be available once the game starts.
            </p>
          </div>
        ) : loading ? (
          <p style={{ marginTop: "1.25rem", color: "var(--muted)" }}>Loading box score...</p>
        ) : failed || !feed ? (
          <p style={{ marginTop: "1.25rem", color: "var(--muted)" }}>
            The box score couldn&apos;t be loaded right now.
          </p>
        ) : (
          <div style={{ marginTop: "1.25rem", display: "grid", gap: "1.25rem" }}>
            {innings.length > 0 && (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  fontSize: "0.72rem",
                }}
              >
                <colgroup>
                  <col style={{ width: `${teamColWidth}%` }} />
                  {innings.map((inning) => (
                    <col key={inning.num} style={{ width: `${inningColWidth}%` }} />
                  ))}
                  <col style={{ width: `${statColWidth}%` }} />
                  <col style={{ width: `${statColWidth}%` }} />
                  <col style={{ width: `${statColWidth}%` }} />
                </colgroup>
                <thead>
                  <tr style={{ textAlign: "center", color: "var(--muted)" }}>
                    <th style={{ ...cellStyle, textAlign: "left" }}>Team</th>
                    {innings.map((inning) => (
                      <th key={inning.num} style={cellStyle}>
                        {inning.num}
                      </th>
                    ))}
                    <th style={cellStyle}>R</th>
                    <th style={cellStyle}>H</th>
                    <th style={cellStyle}>E</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ ...cellStyle, textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <img
                          src={getTeamLogoUrl(game.teams.away.team.id)}
                          alt=""
                          width={16}
                          height={16}
                          style={{ flexShrink: 0 }}
                        />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {game.teams.away.team.teamName ?? game.teams.away.team.name}
                        </span>
                        {game.teams.away.leagueRecord && (
                          <span style={{ color: "var(--muted)", flexShrink: 0 }}>
                            ({game.teams.away.leagueRecord.wins}-{game.teams.away.leagueRecord.losses})
                          </span>
                        )}
                      </div>
                    </td>
                    {innings.map((inning) => (
                      <td key={`away-${inning.num}`} style={cellStyle}>
                        {inning.away?.runs ?? "-"}
                      </td>
                    ))}
                    <td style={{ ...scoreCellStyle, fontWeight: 800 }}>{lineTeams?.away.runs ?? 0}</td>
                    <td style={scoreCellStyle}>{lineTeams?.away.hits ?? 0}</td>
                    <td style={scoreCellStyle}>{lineTeams?.away.errors ?? 0}</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ ...cellStyle, textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <img
                          src={getTeamLogoUrl(game.teams.home.team.id)}
                          alt=""
                          width={16}
                          height={16}
                          style={{ flexShrink: 0 }}
                        />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {game.teams.home.team.teamName ?? game.teams.home.team.name}
                        </span>
                        {game.teams.home.leagueRecord && (
                          <span style={{ color: "var(--muted)", flexShrink: 0 }}>
                            ({game.teams.home.leagueRecord.wins}-{game.teams.home.leagueRecord.losses})
                          </span>
                        )}
                      </div>
                    </td>
                    {innings.map((inning) => (
                      <td key={`home-${inning.num}`} style={cellStyle}>
                        {inning.home?.runs ?? "-"}
                      </td>
                    ))}
                    <td style={{ ...scoreCellStyle, fontWeight: 800 }}>{lineTeams?.home.runs ?? 0}</td>
                    <td style={scoreCellStyle}>{lineTeams?.home.hits ?? 0}</td>
                    <td style={scoreCellStyle}>{lineTeams?.home.errors ?? 0}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {game.decisions && (
              <p style={{ margin: 0, color: "var(--muted)" }}>
                {game.decisions.winner?.fullName && (
                  <>
                    W: <PlayerNameLink id={game.decisions.winner.id} name={game.decisions.winner.fullName} />
                    {"  "}
                  </>
                )}
                {game.decisions.loser?.fullName && (
                  <>
                    L: <PlayerNameLink id={game.decisions.loser.id} name={game.decisions.loser.fullName} />
                    {"  "}
                  </>
                )}
                {game.decisions.save?.fullName && (
                  <>
                    SV: <PlayerNameLink id={game.decisions.save.id} name={game.decisions.save.fullName} />
                  </>
                )}
              </p>
            )}

            <div className="box-score-tabs">
              <button
                type="button"
                className={`box-score-tab${activeTeam === "away" ? " active" : ""}`}
                onClick={() => setActiveTeam("away")}
              >
                {teamAbbreviation(game.teams.away.team)}
              </button>
              <button
                type="button"
                className={`box-score-tab${activeTeam === "home" ? " active" : ""}`}
                onClick={() => setActiveTeam("home")}
              >
                {teamAbbreviation(game.teams.home.team)}
              </button>
            </div>

            <div className="box-score-split">
              <div className={`box-score-team-panel${activeTeam === "away" ? " active" : ""}`}>
                <TeamBoxScore
                  label={game.teams.away.team.teamName ?? game.teams.away.team.name}
                  team={feed.liveData.boxscore.teams.away}
                />
              </div>
              <div className={`box-score-team-panel${activeTeam === "home" ? " active" : ""}`}>
                <TeamBoxScore
                  label={game.teams.home.team.teamName ?? game.teams.home.team.name}
                  team={feed.liveData.boxscore.teams.home}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
