"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  formatGameDate,
  formatGameTime,
  getCardinalsResult,
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
        marginLeft: "0.4rem",
        fontSize: "0.72rem",
        fontWeight: 800,
        padding: "0.1rem 0.4rem",
        borderRadius: "999px",
        color: isPositive ? "#0f7a38" : "#b42318",
        background: isPositive ? "rgba(15,122,56,0.12)" : "rgba(180,35,24,0.12)",
      }}
    >
      {code}
    </span>
  );
}

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
        ? `Pinch hit for ${previous.person.fullName}`
        : `In for ${previous.person.fullName}`;
    }

    return { player, subNote };
  });

  const pitchers = team.pitchers
    .map((id) => team.players[`ID${id}`])
    .filter((player): player is BoxPlayer => Boolean(player));

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <h3 style={{ margin: 0 }}>{label}</h3>

      {batters.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "440px" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "0.85rem" }}>
                <th style={{ padding: "0.4rem 0.5rem" }}>Batting</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>Pos</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>AB</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>R</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>H</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>RBI</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>BB</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>SO</th>
              </tr>
            </thead>
            <tbody>
              {batters.map(({ player, subNote }) => (
                <tr key={player.person.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>
                    <PlayerNameLink id={player.person.id} name={player.person.fullName} />
                    {subNote && (
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem", fontWeight: 400 }}>
                        {subNote}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.position?.abbreviation ?? "-"}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.batting?.atBats ?? 0}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.batting?.runs ?? 0}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.batting?.hits ?? 0}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.batting?.rbi ?? 0}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.batting?.baseOnBalls ?? 0}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.batting?.strikeOuts ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pitchers.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "440px" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "0.85rem" }}>
                <th style={{ padding: "0.4rem 0.5rem" }}>Pitching</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>IP</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>H</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>R</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>ER</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>BB</th>
                <th style={{ padding: "0.4rem 0.5rem" }}>K</th>
              </tr>
            </thead>
            <tbody>
              {pitchers.map((player) => (
                <tr key={player.person.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>
                    <PlayerNameLink id={player.person.id} name={player.person.fullName} />
                    <DecisionBadge note={player.stats.pitching?.note} />
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.pitching?.inningsPitched ?? "-"}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.pitching?.hits ?? 0}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.pitching?.runs ?? 0}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.pitching?.earnedRuns ?? 0}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.pitching?.baseOnBalls ?? 0}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{player.stats.pitching?.strikeOuts ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

  const postponed = isPostponed(game);
  const isPreview = game.status.abstractGameState === "Preview";
  const isFinal = game.status.abstractGameState === "Final" && !postponed;
  const result = getCardinalsResult(game);
  const resultColor = result.isTie ? "var(--muted)" : result.isWin ? "#0f7a38" : "#b42318";
  const awayScoreColor = isFinal && !result.cardinalsAreHome ? resultColor : undefined;
  const homeScoreColor = isFinal && result.cardinalsAreHome ? resultColor : undefined;

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
          {game.teams.away.team.name} @ {game.teams.home.team.name}
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <img src={getTeamLogoUrl(game.teams.away.team.id)} alt="" width={28} height={28} />
            <span style={{ fontWeight: 700 }}>{game.teams.away.team.name}</span>
            <span style={{ fontWeight: 800, color: awayScoreColor }}>{game.teams.away.score ?? 0}</span>
          </div>
          <span style={{ color: "var(--muted)" }}>-</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontWeight: 800, color: homeScoreColor }}>{game.teams.home.score ?? 0}</span>
            <span style={{ fontWeight: 700 }}>{game.teams.home.team.name}</span>
            <img src={getTeamLogoUrl(game.teams.home.team.id)} alt="" width={28} height={28} />
          </div>
        </div>

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
          <div style={{ marginTop: "1.25rem", display: "grid", gap: "1.5rem" }}>
            {innings.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "480px" }}>
                  <thead>
                    <tr style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                      <th style={{ padding: "0.4rem 0.5rem", textAlign: "left" }}>Team</th>
                      {innings.map((inning) => (
                        <th key={inning.num} style={{ padding: "0.4rem 0.35rem", minWidth: "28px" }}>
                          {inning.num}
                        </th>
                      ))}
                      <th style={{ padding: "0.4rem 0.5rem" }}>R</th>
                      <th style={{ padding: "0.4rem 0.5rem" }}>H</th>
                      <th style={{ padding: "0.4rem 0.5rem" }}>E</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>{game.teams.away.team.name}</td>
                      {innings.map((inning) => (
                        <td key={`away-${inning.num}`} style={{ padding: "0.4rem 0.35rem", textAlign: "center" }}>
                          {inning.away?.runs ?? "-"}
                        </td>
                      ))}
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "center", fontWeight: 800 }}>
                        {lineTeams?.away.runs ?? 0}
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>{lineTeams?.away.hits ?? 0}</td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>{lineTeams?.away.errors ?? 0}</td>
                    </tr>
                    <tr style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>{game.teams.home.team.name}</td>
                      {innings.map((inning) => (
                        <td key={`home-${inning.num}`} style={{ padding: "0.4rem 0.35rem", textAlign: "center" }}>
                          {inning.home?.runs ?? "-"}
                        </td>
                      ))}
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "center", fontWeight: 800 }}>
                        {lineTeams?.home.runs ?? 0}
                      </td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>{lineTeams?.home.hits ?? 0}</td>
                      <td style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>{lineTeams?.home.errors ?? 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <TeamBoxScore label={game.teams.away.team.name} team={feed.liveData.boxscore.teams.away} />
            <TeamBoxScore label={game.teams.home.team.name} team={feed.liveData.boxscore.teams.home} />

            {game.decisions && (
              <div>
                <p className="kicker" style={{ marginBottom: "0.35rem" }}>
                  Decisions
                </p>
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
