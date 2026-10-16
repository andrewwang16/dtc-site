import { CARDINALS_TEAM_ID, getTeamAbbreviation } from "@/lib/mlb";

// Names and colors for every club, for the roster builder's team picker
// and its downloadable graphic. `primary` is a dark color the graphic's
// header sits on, `accent` the stripe under it, and `highlight` a color
// that reads well as text on the light page (section titles, positions).
export type TeamInfo = {
  id: number;
  name: string;
  shortName: string;
  primary: string;
  accent: string;
  highlight: string;
};

const TEAMS: Array<Omit<TeamInfo, "id"> & { id: number }> = [
  { id: 109, name: "Arizona Diamondbacks", shortName: "Diamondbacks", primary: "#A71930", accent: "#E3D4AD", highlight: "#A71930" },
  { id: 144, name: "Atlanta Braves", shortName: "Braves", primary: "#13274F", accent: "#CE1141", highlight: "#CE1141" },
  { id: 110, name: "Baltimore Orioles", shortName: "Orioles", primary: "#1A1A1A", accent: "#DF4601", highlight: "#C93D00" },
  { id: 111, name: "Boston Red Sox", shortName: "Red Sox", primary: "#0C2340", accent: "#BD3039", highlight: "#BD3039" },
  { id: 112, name: "Chicago Cubs", shortName: "Cubs", primary: "#0E3386", accent: "#CC3433", highlight: "#0E3386" },
  { id: 145, name: "Chicago White Sox", shortName: "White Sox", primary: "#27251F", accent: "#C4CED4", highlight: "#27251F" },
  { id: 113, name: "Cincinnati Reds", shortName: "Reds", primary: "#1A1A1A", accent: "#C6011F", highlight: "#C6011F" },
  { id: 114, name: "Cleveland Guardians", shortName: "Guardians", primary: "#00385D", accent: "#E50022", highlight: "#E50022" },
  { id: 115, name: "Colorado Rockies", shortName: "Rockies", primary: "#33006F", accent: "#C4CED4", highlight: "#33006F" },
  { id: 116, name: "Detroit Tigers", shortName: "Tigers", primary: "#0C2340", accent: "#FA4616", highlight: "#0C2340" },
  { id: 117, name: "Houston Astros", shortName: "Astros", primary: "#002D62", accent: "#EB6E1F", highlight: "#002D62" },
  { id: 118, name: "Kansas City Royals", shortName: "Royals", primary: "#004687", accent: "#BD9B60", highlight: "#004687" },
  { id: 108, name: "Los Angeles Angels", shortName: "Angels", primary: "#003263", accent: "#BA0021", highlight: "#BA0021" },
  { id: 119, name: "Los Angeles Dodgers", shortName: "Dodgers", primary: "#005A9C", accent: "#EF3E42", highlight: "#005A9C" },
  { id: 146, name: "Miami Marlins", shortName: "Marlins", primary: "#1A1A1A", accent: "#00A3E0", highlight: "#0077A8" },
  { id: 158, name: "Milwaukee Brewers", shortName: "Brewers", primary: "#12284B", accent: "#FFC52F", highlight: "#12284B" },
  { id: 142, name: "Minnesota Twins", shortName: "Twins", primary: "#002B5C", accent: "#D31145", highlight: "#D31145" },
  { id: 121, name: "New York Mets", shortName: "Mets", primary: "#002D72", accent: "#FF5910", highlight: "#002D72" },
  { id: 147, name: "New York Yankees", shortName: "Yankees", primary: "#0C2340", accent: "#C4CED3", highlight: "#0C2340" },
  { id: 133, name: "Athletics", shortName: "Athletics", primary: "#003831", accent: "#EFB21E", highlight: "#003831" },
  { id: 143, name: "Philadelphia Phillies", shortName: "Phillies", primary: "#002D72", accent: "#E81828", highlight: "#E81828" },
  { id: 134, name: "Pittsburgh Pirates", shortName: "Pirates", primary: "#27251F", accent: "#FDB827", highlight: "#27251F" },
  { id: 135, name: "San Diego Padres", shortName: "Padres", primary: "#2F241D", accent: "#FFC425", highlight: "#2F241D" },
  { id: 137, name: "San Francisco Giants", shortName: "Giants", primary: "#27251F", accent: "#FD5A1E", highlight: "#D9480F" },
  { id: 136, name: "Seattle Mariners", shortName: "Mariners", primary: "#0C2C56", accent: "#005C5C", highlight: "#005C5C" },
  { id: 138, name: "St. Louis Cardinals", shortName: "Cardinals", primary: "#0F2A52", accent: "#C41E3A", highlight: "#C41E3A" },
  { id: 139, name: "Tampa Bay Rays", shortName: "Rays", primary: "#092C5C", accent: "#8FBCE6", highlight: "#092C5C" },
  { id: 140, name: "Texas Rangers", shortName: "Rangers", primary: "#003278", accent: "#C0111F", highlight: "#C0111F" },
  { id: 141, name: "Toronto Blue Jays", shortName: "Blue Jays", primary: "#134A8E", accent: "#E8291C", highlight: "#134A8E" },
  { id: 120, name: "Washington Nationals", shortName: "Nationals", primary: "#14225A", accent: "#AB0003", highlight: "#AB0003" },
];

const TEAMS_BY_ID = new Map(TEAMS.map((team) => [team.id, team]));

// Alphabetical by full name, for the team picker.
export const ALL_TEAMS: TeamInfo[] = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name));

export function getTeamInfo(teamId: number): TeamInfo {
  return TEAMS_BY_ID.get(teamId) ?? TEAMS_BY_ID.get(CARDINALS_TEAM_ID)!;
}

// The roster builder's ?team= value: an abbreviation ("nyy") or an id.
export function parseTeamParam(value: string | undefined): number {
  if (!value) {
    return CARDINALS_TEAM_ID;
  }
  const byId = Number(value);
  if (TEAMS_BY_ID.has(byId)) {
    return byId;
  }
  const byAbbreviation = TEAMS.find((team) => getTeamAbbreviation(team.id).toLowerCase() === value.toLowerCase());
  return byAbbreviation?.id ?? CARDINALS_TEAM_ID;
}
