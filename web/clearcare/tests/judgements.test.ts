// tests/judgements.test.ts
// How a regulation was judged at each inspection (lib/judgements.ts): the cells of a regulation's
// row, and from the same cells the grid of judgments and the findings an inspection's row on the
// timeline names (CCARE-235).
// Run with: npm test
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { Inspection, PromiseTrail, RegulationHistory } from "../lib/centres";
import { buildCells, inspectionFindings, judgementGrid, namesNotCompliant } from "../lib/judgements.ts";

const inspection = (id: string, date: string, regulationJudgements = true): Inspection => ({
  id,
  date,
  type: "Unannounced",
  reportUrl: `https://www.hiqa.ie/report-${id}.pdf`,
  regulationJudgements,
});

// Three inspections, oldest first, as getCentreReports returns them.
const INSPECTIONS = [inspection("1", "2023-05-10"), inspection("2", "2024-08-16"), inspection("3", "2025-06-25")];

const row = (number: number, title: string, results: RegulationHistory["results"]): RegulationHistory => ({
  regulation: { number, title },
  results,
});

// The trail of a finding one inspection made.
const trail = (number: number, title: string, inspectionId: string): PromiseTrail => ({
  regulation: { number, title },
  finding: { inspectionId, judgement: "not-compliant", quotes: [], source: { document: "report", page: 10 } },
  promises: [],
});

const titles = (found: ReturnType<typeof inspectionFindings>) => found?.findings.map((finding) => finding.regulation.title);

describe("the cells of a regulation's row", () => {
  test("say how each inspection judged the regulation, and not assessed where one did not", () => {
    const premises = row(17, "Premises", { "1": "compliant", "3": "not-compliant" });

    const cells = buildCells(premises, INSPECTIONS, []);

    assert.deepEqual(cells.get("1"), { judgement: "compliant", trail: undefined });
    assert.deepEqual(cells.get("2"), { judgement: "not-assessed", trail: undefined });
    assert.deepEqual(cells.get("3"), { judgement: "not-compliant", trail: undefined });
  });

  test("have none for an inspection whose report gave no regulation judgments", () => {
    const premises = row(17, "Premises", { "3": "not-compliant" });

    const cells = buildCells(premises, [...INSPECTIONS, inspection("4", "2026-02-05", false)], []);

    assert.deepEqual([...cells.keys()], ["1", "2", "3"]);
  });

  test("a cell has the trail that starts from its inspection's finding", () => {
    const premises = row(17, "Premises", { "2": "not-compliant", "3": "not-compliant" });
    const fromSecond = trail(17, "Premises", "2");

    const cells = buildCells(premises, INSPECTIONS, [fromSecond, trail(28, "Fire precautions", "3")]);

    assert.equal(cells.get("2")?.trail, fromSecond);
    assert.equal(cells.get("3")?.trail, undefined);
  });
});

describe("the findings of one inspection", () => {
  test("names each regulation judged not compliant or substantially compliant", () => {
    const history = [
      row(17, "Premises", { "3": "not-compliant" }),
      row(5, "Individual assessment and care plan", { "3": "substantially-compliant" }),
    ];

    const found = inspectionFindings("3", history, INSPECTIONS, []);

    assert.deepEqual(
      found?.findings.map(({ regulation, judgement }) => [regulation.title, judgement]),
      [
        ["Premises", "not-compliant"],
        ["Individual assessment and care plan", "substantially-compliant"],
      ],
    );
  });

  test("counts the compliant judgments and does not name them", () => {
    const history = [
      row(17, "Premises", { "3": "not-compliant" }),
      row(9, "Residents' rights", { "3": "compliant" }),
      row(15, "Staffing", { "3": "compliant" }),
    ];

    const found = inspectionFindings("3", history, INSPECTIONS, []);

    assert.deepEqual(titles(found), ["Premises"]);
    assert.equal(found?.compliant, 2);
  });

  test("puts not compliant before substantially compliant, each by regulation number", () => {
    const history = [
      row(23, "Governance and management", { "3": "substantially-compliant" }),
      row(28, "Fire precautions", { "3": "not-compliant" }),
      row(5, "Individual assessment and care plan", { "3": "substantially-compliant" }),
      row(17, "Premises", { "3": "not-compliant" }),
    ];

    const found = inspectionFindings("3", history, INSPECTIONS, []);

    assert.deepEqual(titles(found), ["Premises", "Fire precautions", "Individual assessment and care plan", "Governance and management"]);
  });

  test("leaves out a regulation the inspection did not judge", () => {
    const history = [row(17, "Premises", { "2": "not-compliant" }), row(15, "Staffing", { "3": "compliant" })];

    const found = inspectionFindings("3", history, INSPECTIONS, []);

    assert.deepEqual(found, { findings: [], compliant: 1 });
  });

  test("says no more of a finding than its regulation, its judgment and its trail", () => {
    const history = [row(17, "Premises", { "1": "compliant", "3": "not-compliant" })];

    const found = inspectionFindings("3", history, INSPECTIONS, []);

    assert.deepEqual(found?.findings, [{ regulation: { number: 17, title: "Premises" }, judgement: "not-compliant", trail: undefined }]);
  });

  test("gives a finding the trail that starts from it", () => {
    const history = [
      row(17, "Premises", { "2": "not-compliant", "3": "not-compliant" }),
      row(28, "Fire precautions", { "3": "not-compliant" }),
    ];
    const fromSecond = trail(17, "Premises", "2");

    const second = inspectionFindings("2", history, INSPECTIONS, [fromSecond]);
    const third = inspectionFindings("3", history, INSPECTIONS, [fromSecond]);

    assert.equal(second?.findings[0].trail, fromSecond);
    assert.deepEqual(
      third?.findings.map((finding) => finding.trail),
      [undefined, undefined],
    );
  });

  test("is null for an inspection the page holds no report of", () => {
    const history = [row(17, "Premises", { "3": "not-compliant" })];

    assert.equal(inspectionFindings("406", history, INSPECTIONS, []), null);
  });

  test("is null for an inspection whose report gave no regulation judgments", () => {
    const inspections = [...INSPECTIONS, inspection("4", "2026-02-05", false)];
    const history = [row(17, "Premises", { "3": "not-compliant" })];

    assert.equal(inspectionFindings("4", history, inspections, []), null);
  });
});

const judgements = (cells: { judgement: string }[]) => cells.map((cell) => cell.judgement);

describe("the grid of judgments", () => {
  test("has a row for each regulation that was a finding at least once", () => {
    const history = [
      row(17, "Premises", { "1": "compliant", "3": "not-compliant" }),
      row(9, "Residents' rights", { "1": "compliant", "2": "compliant" }),
      row(5, "Individual assessment and care plan", { "2": "substantially-compliant" }),
    ];

    const grid = judgementGrid(history, INSPECTIONS, []);

    assert.deepEqual(
      grid.rows.map((gridRow) => gridRow.regulation.title),
      ["Premises", "Individual assessment and care plan"],
    );
  });

  test("leaves the regulations that were compliant whenever they were judged for the line under it, by number", () => {
    const history = [
      row(17, "Premises", { "3": "not-compliant" }),
      row(15, "Staffing", { "1": "compliant", "3": "compliant" }),
      row(9, "Residents' rights", { "2": "compliant" }),
    ];

    const grid = judgementGrid(history, INSPECTIONS, []);

    assert.deepEqual(grid.rest, [
      { number: 9, title: "Residents' rights" },
      { number: 15, title: "Staffing" },
    ]);
  });

  test("puts the regulation most often not compliant first", () => {
    const history = [
      row(17, "Premises", { "3": "not-compliant" }),
      row(5, "Individual assessment and care plan", { "1": "substantially-compliant", "2": "substantially-compliant", "3": "substantially-compliant" }),
      row(28, "Fire precautions", { "2": "not-compliant", "3": "not-compliant" }),
    ];

    const grid = judgementGrid(history, INSPECTIONS, []);

    assert.deepEqual(
      grid.rows.map((gridRow) => gridRow.regulation.title),
      ["Fire precautions", "Premises", "Individual assessment and care plan"],
    );
  });

  test("then the one most often substantially compliant, then by regulation number", () => {
    const history = [
      row(23, "Governance and management", { "1": "not-compliant" }),
      row(28, "Fire precautions", { "1": "not-compliant", "2": "substantially-compliant" }),
      row(17, "Premises", { "3": "not-compliant" }),
    ];

    const grid = judgementGrid(history, INSPECTIONS, []);

    assert.deepEqual(
      grid.rows.map((gridRow) => gridRow.regulation.title),
      ["Fire precautions", "Premises", "Governance and management"],
    );
  });

  test("has a column for each inspection that judged regulations, the oldest on the left", () => {
    // A thematic inspection judges the National Standards, so it has no column.
    const inspections = [INSPECTIONS[0], inspection("9", "2023-11-02", false), INSPECTIONS[1], INSPECTIONS[2]];
    const history = [row(17, "Premises", { "1": "not-compliant" })];

    const grid = judgementGrid(history, inspections, []);

    assert.deepEqual(
      grid.columns.map((column) => column.id),
      ["1", "2", "3"],
    );
  });

  test("gives a row a cell for each column: the judgment, or not assessed", () => {
    const inspections = [INSPECTIONS[0], inspection("9", "2023-11-02", false), INSPECTIONS[1], INSPECTIONS[2]];
    const history = [row(17, "Premises", { "1": "substantially-compliant", "3": "compliant" })];

    const grid = judgementGrid(history, inspections, []);

    assert.deepEqual(judgements(grid.rows[0].cells), ["substantially-compliant", "not-assessed", "compliant"]);
  });

  test("gives a finding's cell the trail that starts from it", () => {
    const history = [row(17, "Premises", { "2": "not-compliant", "3": "not-compliant" })];
    const fromSecond = trail(17, "Premises", "2");

    const grid = judgementGrid(history, INSPECTIONS, [fromSecond]);

    assert.deepEqual(
      grid.rows[0].cells.map((cell) => cell.trail),
      [undefined, fromSecond, undefined],
    );
  });

  test("has no row for a home where no regulation was ever a finding", () => {
    const history = [row(15, "Staffing", { "1": "compliant" }), row(9, "Residents' rights", { "3": "compliant" })];

    const grid = judgementGrid(history, INSPECTIONS, []);

    assert.deepEqual(grid.rows, []);
    assert.equal(grid.rest.length, 2);
  });
});

describe("the regulations judged not compliant on an inspection's row", () => {
  test("are named when there are up to three", () => {
    assert.equal(namesNotCompliant(1), true);
    assert.equal(namesNotCompliant(3), true);
  });

  test("are counted, not named, when there are four or more", () => {
    // 15 is the most one inspection has.
    assert.equal(namesNotCompliant(4), false);
    assert.equal(namesNotCompliant(15), false);
  });
});
