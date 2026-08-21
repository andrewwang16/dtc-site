export type SeasonStatLine = {
  gamesPlayed?: number;
  gamesPitched?: number;
  gamesStarted?: number;
  plateAppearances?: number;
  battersFaced?: number;
  atBats?: number;
  hits?: number;
  runs?: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  rbi?: number;
  stolenBases?: number;
  baseOnBalls?: number;
  strikeOuts?: number;
  avg?: string;
  obp?: string;
  slg?: string;
  ops?: string;
  inningsPitched?: string;
  era?: string;
  whip?: string;
  wins?: number;
  losses?: number;
  saves?: number;
  holds?: number;
  strikeoutWalkRatio?: string;
};

export type TeamPlayerSeason = {
  id: number;
  name: string;
  position: string;
  role: "Hitter" | "Pitcher";
  imageUrl: string;
  hitting: SeasonStatLine | undefined;
  pitching: SeasonStatLine | undefined;
};

export type LeaderboardPlayer = {
  id: number;
  name: string;
  position: string;
  imageUrl: string;
  displayValue: string;
  sortValue: number;
};

export type LeaderboardCategory = {
  key: string;
  label: string;
  description: string;
  sortDirection: "asc" | "desc";
  qualified: boolean;
  players: LeaderboardPlayer[];
};

export type LeaderboardTabData = {
  key: "hitters" | "pitchers";
  categories: LeaderboardCategory[];
};

export type StatsLeadersPageData = {
  year: number;
  totalPlayers: number;
  teamGamesPlayed: number;
  hitterQualificationPA: number;
  pitcherQualificationOuts: number;
  hitters: LeaderboardTabData;
  pitchers: LeaderboardTabData;
};
