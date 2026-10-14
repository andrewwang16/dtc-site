// Contract and arbitration data for the roster builder. None of this is in
// the MLB Stats API, so it's maintained by hand — update it as deals are
// signed, options are decided, and arbitration figures settle.
//
// Sources (as of Oct 14, 2026):
// - Arbitration projections: MLB Trade Rumors, "Projected Arbitration
//   Salaries For 2027" (Oct 2, 2026)
// - Guaranteed contracts, arb years and free-agency timing (including the
//   pre-arb players it lists): FanGraphs RosterResource Cardinals payroll
// - Stanek's club option: MLB Trade Rumors

export const CONTRACT_SEASON = 2027;

// The 2026 league minimum. The 2027 figure depends on the new CBA, so
// pre-arb salaries are an estimate until that's settled.
export const PRE_ARB_SALARY_ESTIMATE = 780_000;

// "signed" is a deal made inside the roster builder (a created player or a
// free agent), not a real contract.
export type ContractStatus = "guaranteed" | "signed" | "club-option" | "arbitration" | "pre-arb";

export type ContractInfo = {
  status: ContractStatus;
  // Salary for CONTRACT_SEASON — projected for arbitration players.
  salary: number;
  detail: string;
  freeAgentAfter?: number;
  // True when freeAgentAfter is the earliest possible year, estimated from
  // the MLB debut date rather than taken from a source.
  freeAgentEstimated?: boolean;
  // Owed if the club declines the option (player removed from the 40-man).
  buyout?: number;
};

// Keyed by MLB player id.
const CONTRACTS: Record<number, ContractInfo> = {
  802139: {
    status: "guaranteed",
    salary: 2_750_000,
    detail: "8 yr / $112.5M (2027–34)",
    freeAgentAfter: 2034,
  },
  592773: {
    status: "club-option",
    salary: 6_000_000,
    detail: "$6M club option, $1M buyout",
    freeAgentAfter: 2027,
    buyout: 1_000_000,
  },
  669467: { status: "arbitration", salary: 7_500_000, detail: "Arb 2 · MLBTR projection", freeAgentAfter: 2028 },
  669357: { status: "arbitration", salary: 3_400_000, detail: "Arb 2 · MLBTR projection", freeAgentAfter: 2028 },
  676475: { status: "arbitration", salary: 8_300_000, detail: "Arb 2 · MLBTR projection", freeAgentAfter: 2028 },
  669461: { status: "arbitration", salary: 3_600_000, detail: "Arb 2 · MLBTR projection", freeAgentAfter: 2029 },
  691026: { status: "arbitration", salary: 3_300_000, detail: "Arb 1 · MLBTR projection", freeAgentAfter: 2029 },
  691023: { status: "arbitration", salary: 5_100_000, detail: "Arb 1 · MLBTR projection", freeAgentAfter: 2029 },
  671056: { status: "arbitration", salary: 5_500_000, detail: "Arb 1 · MLBTR projection", freeAgentAfter: 2029 },
  686780: { status: "arbitration", salary: 1_300_000, detail: "Arb 1 (Super Two) · MLBTR projection", freeAgentAfter: 2030 },
  681517: { status: "arbitration", salary: 2_800_000, detail: "Arb 1 (Super Two) · MLBTR projection", freeAgentAfter: 2030 },
};

// Free-agency year for the pre-arb players FanGraphs lists individually.
const PRE_ARB_FREE_AGENT_AFTER: Record<number, number> = {
  666277: 2030, // George Soriano
  665877: 2030, // José Fermín
  700241: 2031, // Michael McGreevy
  700669: 2031, // Gordon Graceffo
  701675: 2031, // Nathan Church
  699024: 2032, // Leo Bernal
  687273: 2032, // Quinn Mathews
};

// Free agency comes after six years of MLB service. Without service-time
// data, assume a player has been up continuously since debuting: a debut
// by mid-April counts that season as a full year. Any time spent in the
// minors since pushes the real date later, so this is the earliest it
// could be. A player who hasn't debuted can't reach six years before
// CONTRACT_SEASON + 5, even with a full season in the majors next year.
function estimateFreeAgentAfter(debutDate?: string): number {
  if (!debutDate) {
    return CONTRACT_SEASON + 5;
  }

  const debut = new Date(debutDate);
  const year = debut.getUTCFullYear();
  const isFullSeason = debut.getUTCMonth() < 3 || (debut.getUTCMonth() === 3 && debut.getUTCDate() <= 15);

  return year + (isFullSeason ? 5 : 6);
}

function preArbContract(playerId: number, debutDate?: string): ContractInfo {
  const known = PRE_ARB_FREE_AGENT_AFTER[playerId];

  return {
    status: "pre-arb",
    salary: PRE_ARB_SALARY_ESTIMATE,
    detail: "Pre-arb · near league minimum",
    freeAgentAfter: known ?? estimateFreeAgentAfter(debutDate),
    freeAgentEstimated: known === undefined,
  };
}

// Anyone already in the organization without a listed deal is pre-arb.
// Players from other teams (or created by hand) have no known contract.
export function getContract(
  player: { id: number; debutDate?: string },
  isOrganizational: boolean
): ContractInfo | null {
  return CONTRACTS[player.id] ?? (isOrganizational ? preArbContract(player.id, player.debutDate) : null);
}

export type Signing = { salary: number; years: number };

// A deal made in the roster builder: `salary` is the per-year amount.
export function signedContract({ salary, years }: Signing): ContractInfo {
  const lastSeason = CONTRACT_SEASON + years - 1;
  const seasons = years === 1 ? `${CONTRACT_SEASON}` : `${CONTRACT_SEASON}–${String(lastSeason).slice(2)}`;

  return {
    status: "signed",
    salary,
    detail: `${years} yr / ${formatSalary(salary * years)} (${seasons})`,
    freeAgentAfter: lastSeason,
  };
}

export function formatSalary(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 2).replace(/0$/, "")}M`;
  }

  return `$${Math.round(amount / 1_000)}K`;
}
