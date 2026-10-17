// Competitive balance (luxury) tax. The 2022–26 CBA's thresholds and rates
// are used for 2027 until the next CBA sets new ones.

import contractData from "./contracts-data.json";

// Base threshold, then the three surcharge tiers ($20M, $40M and $60M over).
export const TAX_THRESHOLDS = [244_000_000, 264_000_000, 284_000_000, 304_000_000] as const;

export type PayorStatus = "first" | "second" | "repeat";

// Clubs that paid the tax, by season (MLB's final figures, as reported by
// the AP each December). 2025: nine payors on a $241M threshold.
const OFFICIAL_PAYORS: Record<number, number[]> = {
  // Dodgers, Mets, Yankees, Phillies, Blue Jays, Padres, Astros, Red Sox, Rangers
  2025: [119, 121, 147, 143, 141, 135, 117, 111, 140],
};

// 2026's threshold. Until MLB's final 2026 figures are out (December),
// whether a club was over comes from FanGraphs' end-of-season estimate of
// its tax payroll (lib/contracts-data.json).
const PRIOR_SEASON = 2026;
const PRIOR_THRESHOLD = 244_000_000;
const PRIOR_TAX_PAYROLL = contractData.priorTaxPayroll as Record<string, number>;

export type PayorHistory = {
  status: PayorStatus;
  overPriorSeason: boolean;
  overTwoSeasonsAgo: boolean;
  // True while the prior season comes from an estimate, not MLB's figures.
  priorEstimated: boolean;
  priorTaxPayroll: number | null;
};

// The base tax rate rises with consecutive seasons over the threshold: a
// club over in neither 2025 nor 2026 would pay as a first-time payor in
// 2027, over in 2026 only as a second-year payor, and over in both as a
// third-straight-year (or longer) payor.
export function getPayorHistory(teamId: number): PayorHistory {
  const official = OFFICIAL_PAYORS[PRIOR_SEASON];
  const priorTaxPayroll = PRIOR_TAX_PAYROLL[teamId] ?? null;
  const overPriorSeason = official ? official.includes(teamId) : (priorTaxPayroll ?? 0) > PRIOR_THRESHOLD;
  const overTwoSeasonsAgo = OFFICIAL_PAYORS[PRIOR_SEASON - 1].includes(teamId);

  return {
    status: !overPriorSeason ? "first" : overTwoSeasonsAgo ? "repeat" : "second",
    overPriorSeason,
    overTwoSeasonsAgo,
    priorEstimated: !official,
    priorTaxPayroll,
  };
}

export const PAYOR_STATUS_LABELS: Record<PayorStatus, string> = {
  first: "First-time payor",
  second: "Second straight year",
  repeat: "Third+ straight year",
};

// Tax on everything over the base threshold, by how many straight years
// the club has paid.
const BASE_RATES: Record<PayorStatus, number> = { first: 0.2, second: 0.3, repeat: 0.5 };

// Added on the slice of payroll above each surcharge tier.
const SURCHARGES = [0.12, 0.425, 0.6];

export type LuxuryTax = {
  over: number;
  tax: number;
  // 0 when under the base threshold; 1–4 for the highest threshold passed.
  tier: number;
};

export function computeLuxuryTax(taxPayroll: number, status: PayorStatus): LuxuryTax {
  const [base, ...surchargeTiers] = TAX_THRESHOLDS;
  const over = Math.max(0, taxPayroll - base);
  let tax = over * BASE_RATES[status];

  surchargeTiers.forEach((threshold, index) => {
    const next = surchargeTiers[index + 1] ?? Infinity;
    tax += Math.max(0, Math.min(taxPayroll, next) - threshold) * SURCHARGES[index];
  });

  const tier = TAX_THRESHOLDS.filter((threshold) => taxPayroll > threshold).length;
  return { over, tax, tier };
}
