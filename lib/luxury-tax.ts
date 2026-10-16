// Competitive balance (luxury) tax. The 2022–26 CBA's thresholds and rates
// are used for 2027 until the next CBA sets new ones.

// Base threshold, then the three surcharge tiers ($20M, $40M and $60M over).
export const TAX_THRESHOLDS = [244_000_000, 264_000_000, 284_000_000, 304_000_000] as const;

export type PayorStatus = "first" | "second" | "repeat";

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
