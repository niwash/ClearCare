// tests/compare.test.mjs
// The Compare Homes list and grid logic in lib/compare.ts (CCARE-127). Node strips the file's
// types, so it is loaded as it is. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addHome,
  compareHref,
  compliantWhereverJudged,
  latestJudged,
  MAX_COMPARED,
  notCompliantAtLatest,
  parseCompared,
  parseHomesParam,
  regulationRows,
  removeHome,
  repeatedNotCompliant,
} from "../lib/compare.ts";
import { toCsv } from "../lib/csv.ts";

const home = (id) => ({ id, name: `Home ${id}` });

test("reads a saved list and drops anything malformed", () => {
  assert.deepEqual(parseCompared(null), []);
  assert.deepEqual(parseCompared("not json"), []);
  assert.deepEqual(parseCompared('{"id":"1"}'), []);
  const raw = JSON.stringify([home("1"), { id: "abc", name: "x" }, { id: "2" }, home("1"), null, home("3")]);
  assert.deepEqual(parseCompared(raw), [home("1"), home("3")]);
});

test("keeps at most five homes", () => {
  const raw = JSON.stringify([home("1"), home("2"), home("3"), home("4"), home("5"), home("6")]);
  assert.equal(parseCompared(raw).length, MAX_COMPARED);

  let homes = [];
  for (const id of ["1", "2", "3", "4", "5", "6"]) homes = addHome(homes, home(id));
  assert.deepEqual(homes.map((h) => h.id), ["1", "2", "3", "4", "5"]);
});

test("adds a home once and removes it", () => {
  const once = addHome([home("1")], home("1"));
  assert.equal(once.length, 1);
  assert.deepEqual(removeHome([home("1"), home("2")], "1"), [home("2")]);
});

test("puts the IDs in the address and reads them back", () => {
  assert.equal(compareHref([]), "/compare");
  assert.equal(compareHref(["101", "34"]), "/compare?homes=101,34");
  assert.deepEqual(parseHomesParam("101, 34,abc,101,5,6,7,8"), ["101", "34", "5", "6", "7"]);
  assert.deepEqual(parseHomesParam(["7,8", "9"]), ["7", "8"]);
  assert.deepEqual(parseHomesParam(undefined), []);
});

test("writes CSV a spreadsheet opens safely", () => {
  const csv = toCsv([
    ["", "St. Brigid's, Co. Cork"],
    ['Said "hello"', "line\nbreak"],
    ["=HYPERLINK(1)", "+353 1 234"],
    ["Change", -3],
  ]);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(
    csv.slice(1),
    `,"St. Brigid's, Co. Cork"\r\n"Said ""hello""","line\nbreak"\r\n'=HYPERLINK(1),'+353 1 234\r\nChange,-3\r\n`,
  );
});

// Two homes: A inspected twice, B once. Regulation 5 was only judged at A's first inspection.
const homeA = {
  inspections: [
    { id: "a1", date: "2024-03-01", regulationJudgements: true },
    { id: "a2", date: "2025-06-10", regulationJudgements: true },
    { id: "a3", date: "2026-01-20", regulationJudgements: false }, // thematic
  ],
  history: [
    { regulation: { number: 23, title: "Governance" }, results: { a1: "compliant", a2: "not-compliant" } },
    { regulation: { number: 5, title: "Assessment" }, results: { a1: "substantially-compliant" } },
    { regulation: { number: 9, title: "Rights" }, results: { a2: "compliant" } },
  ],
};
const homeB = {
  inspections: [{ id: "b1", date: "2025-09-02", regulationJudgements: true }],
  history: [
    { regulation: { number: 23, title: "Governance" }, results: { b1: "compliant" } },
    { regulation: { number: 9, title: "Rights" }, results: { b1: "compliant" } },
  ],
};

test("lines up each home's latest judgement per regulation, shortfalls first", () => {
  const rows = regulationRows([homeA, homeB, null]);
  assert.deepEqual(rows.map((row) => row.regulation.number), [23, 5, 9]);
  assert.deepEqual(rows[0].results, [
    { judgement: "not-compliant", date: "2025-06-10" },
    { judgement: "compliant", date: "2025-09-02" },
    null,
  ]);
  assert.deepEqual(rows[1].results, [{ judgement: "substantially-compliant", date: "2024-03-01" }, null, null]);
});

test("folds only regulations no home fell short on", () => {
  // Regulation 9 is compliant at both; 23 and 5 each have a shortfall at home A.
  const rows = regulationRows([homeA, homeB, null]);
  assert.deepEqual(rows.filter(compliantWhereverJudged).map((row) => row.regulation.number), [9]);
});

test("names the regulations not compliant at the latest inspection that judged any", () => {
  // Home A's latest inspection is thematic, so its June 2025 inspection counts.
  assert.deepEqual(notCompliantAtLatest(homeA).map((r) => r.number), [23]);
  assert.deepEqual(notCompliantAtLatest(homeB), []);
});

test("finds no judged inspection for a home with only thematic inspections", () => {
  const thematic = {
    inspections: [{ id: "t1", date: "2025-04-01", regulationJudgements: false }],
    history: [],
  };
  assert.equal(latestJudged(thematic), undefined);
  assert.equal(latestJudged(homeA).id, "a2");
});

test("finds issues not compliant at the last two inspections that judged them", () => {
  const repeated = {
    inspections: [
      { id: "r1", date: "2023-01-01", regulationJudgements: true },
      { id: "r2", date: "2024-01-01", regulationJudgements: true },
      { id: "r3", date: "2025-01-01", regulationJudgements: true },
    ],
    history: [
      // Not compliant, not judged at r2, then not compliant again: the last two that judged it.
      { regulation: { number: 28, title: "Fire" }, results: { r1: "not-compliant", r3: "not-compliant" } },
      // Fixed at the latest inspection.
      { regulation: { number: 15, title: "Staffing" }, results: { r1: "not-compliant", r2: "not-compliant", r3: "compliant" } },
      // Only judged once.
      { regulation: { number: 9, title: "Rights" }, results: { r3: "not-compliant" } },
    ],
  };
  assert.deepEqual(repeatedNotCompliant(repeated).map((r) => r.number), [28]);
  assert.deepEqual(repeatedNotCompliant(homeA), []);
});
