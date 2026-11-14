// tests/fair-deal.test.ts
// The Fair Deal calculator's arithmetic (lib/fair-deal.ts). The first three cases are the worked
// examples in the Fair Deal guide, so the calculator and the guide give the same answers.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { estimateFairDeal, type FairDealInput } from "../lib/fair-deal.ts";

const nothing: FairDealInput = {
  status: "single",
  weeklyIncome: 0,
  weeklyDeductions: 0,
  savings: 0,
  homeValue: 0,
  otherPropertyValue: 0,
  weeklyCareCost: 0,
};

const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.01, `expected about ${expected}, got ${actual}`);

test("Mary: 80% of a single person's income, and nothing from savings under the disregard", () => {
  const { firstYears, laterYears, ownsHome } = estimateFairDeal({
    ...nothing,
    weeklyIncome: 300,
    savings: 20_000,
    weeklyCareCost: 1_200,
  });

  near(firstYears.income, 240);
  near(firstYears.savings, 0);
  near(firstYears.pays, 240);
  near(firstYears.hsePays, 960);
  assert.equal(ownsHome, false);
  assert.deepEqual(laterYears, firstYears);
});

test("Tom and Anne: 40% of a couple's income, and 3.75% of their assets above €72,000", () => {
  const { firstYears } = estimateFairDeal({
    ...nothing,
    status: "couple",
    weeklyIncome: 600,
    savings: 50_000,
    homeValue: 300_000,
  });

  near(firstYears.income, 240);
  // €50,000 + €300,000 − €72,000 = €278,000; 3.75% is €10,425 a year. The savings are all under the
  // disregard, so it is all from the home.
  near(firstYears.savings, 0);
  near(firstYears.property, 10_425 / 52);
});

test("Brigid: the home counts for three years, then drops out", () => {
  const { firstYears, laterYears, ownsHome } = estimateFairDeal({
    ...nothing,
    weeklyIncome: 299.3 + 185,
    homeValue: 300_000,
  });

  // 7.5% of €264,000 is €19,800 a year, about €381 a week.
  near(firstYears.property, 19_800 / 52);
  near(firstYears.total, 0.8 * 484.3 + 19_800 / 52);
  assert.equal(ownsHome, true);
  near(laterYears.property, 0);
  near(laterYears.total, 0.8 * 484.3);
});

test("the disregard comes off savings first, then property", () => {
  const { firstYears } = estimateFairDeal({ ...nothing, savings: 50_000, homeValue: 100_000 });

  near(firstYears.savings, (14_000 * 0.075) / 52);
  near(firstYears.property, (100_000 * 0.075) / 52);
});

test("from year four the disregard applies again to what is left", () => {
  const { laterYears } = estimateFairDeal({ ...nothing, savings: 10_000, homeValue: 200_000, otherPropertyValue: 50_000 });

  // €10,000 of savings uses €10,000 of the disregard; the other €26,000 comes off the other property.
  near(laterYears.savings, 0);
  near(laterYears.property, (24_000 * 0.075) / 52);
});

test("property other than the home has no cap", () => {
  const { firstYears, laterYears } = estimateFairDeal({ ...nothing, otherPropertyValue: 136_000 });

  near(firstYears.property, (100_000 * 0.075) / 52);
  near(laterYears.property, firstYears.property);
});

test("allowable deductions come off income before the rate", () => {
  const { firstYears } = estimateFairDeal({ ...nothing, weeklyIncome: 300, weeklyDeductions: 50 });

  near(firstYears.income, 200);
});

test("never more than the cost of care", () => {
  const { firstYears, laterYears } = estimateFairDeal({
    ...nothing,
    weeklyIncome: 1_000,
    homeValue: 2_000_000,
    weeklyCareCost: 1_300,
  });

  assert.equal(firstYears.cappedAtCost, true);
  near(firstYears.pays, 1_300);
  near(firstYears.hsePays, 0);
  assert.equal(laterYears.cappedAtCost, false);
  near(laterYears.pays, 800);
  near(laterYears.hsePays, 500);
});

test("blank, negative or missing figures count as nothing", () => {
  const { firstYears } = estimateFairDeal({
    ...nothing,
    weeklyIncome: Number.NaN,
    weeklyDeductions: 500,
    savings: -10,
  });

  near(firstYears.total, 0);
  near(firstYears.hsePays, 0);
});
