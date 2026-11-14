// lib/fair-deal.ts
// An estimate of a Fair Deal (Nursing Homes Support Scheme) contribution, from the figures a family
// enters, for the calculator (components/guides/fair-deal-calculator.tsx). The tests load this file
// as it is (tests/fair-deal.test.ts), so it imports nothing.
//
// Only the published arithmetic is here, as the HSE states it on its Financial assessment page
// (https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/financial-assessment/), checked
// 14 Nov 2026 (CCARE-237), and as the Fair Deal guide explains it:
// - Income: 80% of assessable income for a single person, 40% of a couple's combined income.
// - Assets: 7.5% a year of what is owned above a €36,000 disregard for a single person; 3.75% of a
//   couple's combined assets above €72,000. The disregard comes off cash first, then property.
// - The home (principal private residence) counts for the first 3 years in care only. Any other
//   property has no cap.
// - The yearly asset figure is weekly over 52 weeks, as in the HSE's own examples.
// - No one pays more than the cost of their care; the HSE pays the rest.
//
// How the HSE assesses what each figure is (which income counts, which deductions it allows, what a
// property is valued at, gifts, farms and businesses, any amount left for personal spending) is not
// known to us and is not modelled: the person entering the figures decides them. The page says so.

export type FairDealStatus = "single" | "couple";

export type FairDealInput = {
  status: FairDealStatus;
  // Net weekly income (after tax, PRSI and USC): a couple's combined.
  weeklyIncome: number;
  // Allowable deductions a week, such as health expenses or interest on a home loan.
  weeklyDeductions: number;
  // Cash, savings and investments: a couple's combined.
  savings: number;
  // The home's value (principal private residence): the whole of it, for a couple.
  homeValue: number;
  // Any other land or property, such as a holiday home or one that is let.
  otherPropertyValue: number;
  // The nursing home's weekly charge, or 0 when not known yet.
  weeklyCareCost: number;
};

export type FairDealPeriod = {
  income: number; // a week
  savings: number; // a week, the part from cash assets
  property: number; // a week, the part from the home and other property
  total: number; // a week, before the cap at the cost of care
  pays: number; // a week, after it
  hsePays: number; // a week; 0 when the cost of care isn't known
  cappedAtCost: boolean;
};

export type FairDealEstimate = {
  // The first 3 years in care, with the home counted.
  firstYears: FairDealPeriod;
  // From the fourth year, without it. The same as firstYears when there is no home.
  laterYears: FairDealPeriod;
  ownsHome: boolean;
};

export const FAIR_DEAL_RULES = {
  single: { incomeRate: 0.8, assetRate: 0.075, disregard: 36_000 },
  couple: { incomeRate: 0.4, assetRate: 0.0375, disregard: 72_000 },
  capYears: 3,
  weeksInYear: 52,
} as const;

// A figure as entered: blank, negative or not a number counts as nothing.
function amount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function period(input: FairDealInput, countHome: boolean): FairDealPeriod {
  const rules = FAIR_DEAL_RULES[input.status];
  const careCost = amount(input.weeklyCareCost);

  const assessable = Math.max(0, amount(input.weeklyIncome) - amount(input.weeklyDeductions));
  const income = assessable * rules.incomeRate;

  // The disregard comes off cash first, and whatever is left of it off property.
  const cash = amount(input.savings);
  const property = amount(input.otherPropertyValue) + (countHome ? amount(input.homeValue) : 0);
  const cashCounted = Math.max(0, cash - rules.disregard);
  const disregardLeft = Math.max(0, rules.disregard - cash);
  const propertyCounted = Math.max(0, property - disregardLeft);

  const weekly = (value: number) => (value * rules.assetRate) / FAIR_DEAL_RULES.weeksInYear;
  const fromSavings = weekly(cashCounted);
  const fromProperty = weekly(propertyCounted);

  const total = income + fromSavings + fromProperty;
  const cappedAtCost = careCost > 0 && total > careCost;
  const pays = cappedAtCost ? careCost : total;

  return {
    income,
    savings: fromSavings,
    property: fromProperty,
    total,
    pays,
    hsePays: careCost > 0 ? careCost - pays : 0,
    cappedAtCost,
  };
}

export function estimateFairDeal(input: FairDealInput): FairDealEstimate {
  return {
    firstYears: period(input, true),
    laterYears: period(input, false),
    ownsHome: amount(input.homeValue) > 0,
  };
}
