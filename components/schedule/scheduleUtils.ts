import { CARDINALS_TEAM_ID } from "@/lib/mlb";

export { CARDINALS_TEAM_ID };

export type MlbPersonRef = {
  id: number;
  fullName?: string;
};

export type MlbTeamRef = {
  id: number;
  name: string;
};

export type MlbGame = {
  gamePk: number;
  gameDate: string;
  gameType?: string;
  status: {
    abstractGameState?: string;
    detailedState?: string;
  };
  decisions?: {
    winner?: MlbPersonRef;
    loser?: MlbPersonRef;
    save?: MlbPersonRef;
  };
  venue?: {
    name?: string;
  };
  teams: {
    away: {
      score?: number;
      team: MlbTeamRef;
      probablePitcher?: MlbPersonRef;
    };
    home: {
      score?: number;
      team: MlbTeamRef;
      probablePitcher?: MlbPersonRef;
    };
  };
};

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatGameDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(date));
}

export function getGameDay(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/Chicago",
  }).format(new Date(date));
}

export function formatGameTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(new Date(date));
}

export function getOpponent(game: MlbGame) {
  return game.teams.home.team.id === CARDINALS_TEAM_ID ? game.teams.away : game.teams.home;
}

export function getHomeAwayLabel(game: MlbGame) {
  return game.teams.home.team.id === CARDINALS_TEAM_ID ? "Home" : "Away";
}

export function getStatusLabel(game: MlbGame) {
  return game.status.detailedState ?? game.status.abstractGameState ?? "Scheduled";
}

export function isPostponed(game: MlbGame) {
  // MLB marks postponed games as abstractGameState "Final" even though no
  // game was played, so callers must check this before treating a game as
  // final and rendering a score.
  return game.status.detailedState === "Postponed";
}

export function getTeamLogoUrl(teamId: number) {
  return `https://www.mlbstatic.com/team-logos/team-cap-on-light/${teamId}.svg`;
}

export function getGameCardTheme(game: MlbGame) {
  const neutralText = "#111827";
  const neutralMuted = "#5f6778";

  return {
    background: "linear-gradient(135deg, #ffffff 0%, #f7f7f4 100%)",
    border: "#c41e3a",
    text: neutralText,
    muted: neutralMuted,
    accent: "#8a1024",
    logoFilter: "none",
  };
}

export function getCardinalsResult(game: MlbGame) {
  const cardinalsAreHome = game.teams.home.team.id === CARDINALS_TEAM_ID;
  const cardinalsScore = cardinalsAreHome ? game.teams.home.score ?? 0 : game.teams.away.score ?? 0;
  const opponentScore = cardinalsAreHome ? game.teams.away.score ?? 0 : game.teams.home.score ?? 0;
  const isTie = cardinalsScore === opponentScore;

  return {
    cardinalsAreHome,
    cardinalsScore,
    opponentScore,
    isTie,
    isWin: cardinalsScore > opponentScore,
  };
}

export function getDecisionLine(game: MlbGame) {
  const parts: string[] = [];

  if (game.decisions?.winner?.fullName) {
    parts.push(`W: ${game.decisions.winner.fullName}`);
  }

  if (game.decisions?.loser?.fullName) {
    parts.push(`L: ${game.decisions.loser.fullName}`);
  }

  if (game.decisions?.save?.fullName) {
    parts.push(`SV: ${game.decisions.save.fullName}`);
  }

  return parts.join(" · ");
}
