// Contract and arbitration data for the roster builder. None of this is in
// the MLB Stats API, so it's maintained by hand — update it as deals are
// signed, options are decided, and arbitration figures settle.
//
// Sources (as of Oct 14, 2026):
// - Arbitration projections: MLB Trade Rumors, "Projected Arbitration
//   Salaries For 2027" (Oct 2, 2026)
// - Guaranteed contracts, arb years and free-agency timing: FanGraphs
//   RosterResource Cardinals payroll page
// - Stanek's club option: MLB Trade Rumors

export const CONTRACT_SEASON = 2027;

// The 2026 league minimum. The 2027 figure depends on the new CBA, so
// pre-arb salaries are an estimate until that's settled.
export const PRE_ARB_SALARY_ESTIMATE = 780_000;

export type ContractStatus = "guaranteed" | "club-option" | "arbitration" | "pre-arb";

export type ContractInfo = {
  status: ContractStatus;
  // Salary for CONTRACT_SEASON — projected for arbitration players.
  salary: number;
  detail: string;
  freeAgentAfter?: number;
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

const PRE_ARB_CONTRACT: ContractInfo = {
  status: "pre-arb",
  salary: PRE_ARB_SALARY_ESTIMATE,
  detail: "Pre-arb · near league minimum",
};

// Anyone already in the organization without a listed deal is pre-arb.
// Players from other teams (or created by hand) have no known contract.
export function getContract(playerId: number, isOrganizational: boolean): ContractInfo | null {
  return CONTRACTS[playerId] ?? (isOrganizational ? PRE_ARB_CONTRACT : null);
}

export function formatSalary(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 2).replace(/0$/, "")}M`;
  }

  return `$${Math.round(amount / 1_000)}K`;
}
