// tests/findings.test.mjs
// The centre page's highlights and promise trails from GET /centres/{centre_id}/findings
// (lib/findings.ts, CCARE-207). Node strips the file's types, so it is loaded as it is.
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { addFindings, commitment, excerpt, passage, toTrail } from "../lib/findings.ts";

const URL_ = (id) => `https://www.hiqa.ie/report-${id}.pdf`;

const inspection = (id, date) => ({ id, date, type: "Unannounced", reportUrl: URL_(id), regulationJudgements: true });

// Three inspections, oldest first, as getCentreReports returns them.
function reports(rows) {
  return {
    inspections: [inspection("1", "2023-05-10"), inspection("2", "2024-08-16"), inspection("3", "2025-06-25")],
    history: rows.map(([number, title, results]) => ({ regulation: { number, title }, results })),
    highlights: [],
    visitQuestions: [],
    trails: [],
  };
}

const NONE = { report_id: null, inspection_date: null, report_url: null, judgment: null, reports_between: null, inspector: null };

function finding(overrides) {
  const reportId = overrides.report_id ?? 3;
  return {
    report_id: reportId,
    inspection_date: { 1: "2023-05-10", 2: "2024-08-16", 3: "2025-06-25" }[reportId],
    report_url: URL_(reportId),
    regulation: "Regulation 28",
    title: "Fire precautions",
    judgment: "Not compliant",
    compliance_items: [],
    inspector: {
      text: "Regulation 28: Fire precautions\nThe kitchen ductwork had not\nbeen cleaned.\nJudgment: Not compliant",
      first_page: 11,
      last_page: 12,
    },
    provider_response: null,
    stated_deadlines: null,
    re_assessment: { status: "no later report", ...NONE },
    ...overrides,
  };
}

test("drops the heading and the Judgment line, and joins lines the PDF broke", () => {
  const text = "Regulation 28: Fire\nprecautions\nThe kitchen ductwork had not\nbeen cleaned.\n\nFire drills were late.\nJudgment: Not compliant";
  assert.deepEqual(passage(text, "Regulation 28", "Fire precautions", "inspector"), [
    "The kitchen ductwork had not been cleaned.",
    "Fire drills were late.",
  ]);
});

test("falls back to the first line when the report words the title differently", () => {
  const text = "Regulation 23: Governance\nThe provider had no audit.\nJudgment: Substantially compliant";
  assert.deepEqual(passage(text, "Regulation 23", "Governance and management", "inspector"), ["The provider had no audit."]);
});

test("drops the judgment and form wording at the top of a response", () => {
  const text =
    "Regulation 28: Fire precautions Not Compliant\nOutline how you are going to come into compliance with Regulation 28: Fire precautions:\nThe ductwork will be cleaned by 30/09/2024.";
  assert.deepEqual(passage(text, "Regulation 28", "Fire precautions", "response"), ["The ductwork will be cleaned by 30/09/2024."]);
});

test("an excerpt keeps whole sentences and marks where it stops", () => {
  assert.equal(excerpt(["Short one."]), "“Short one.”");
  const long = ["First sentence here.", "x".repeat(300) + "."];
  assert.equal(excerpt(long), "“First sentence here. …”");
  assert.equal(excerpt([`${"word ".repeat(80)}end.`]).endsWith("word…”"), true);
});

// As the extractor serves them: the PDF's line breaks, no blank lines, Word's bullet glyphs.
test("rebuilds paragraphs and list items from the PDF's lines", () => {
  const text = [
    "Regulation 28: Fire precautions",
    "Assurances regarding residents' safety in the event of a fire in the centre were not",
    "adequate as follows;",
    " The inspectors found gaps in the closure of a number of cross-",
    "corridor fire doors.",
    "• Intumescent strips were painted over.  Doors were wedged open.",
    "Staff had completed fire training and knew the evacuation procedures in the",
    "centre.",
    "Judgment: Substantially compliant",
  ].join("\n");
  assert.deepEqual(passage(text, "Regulation 28", "Fire precautions", "inspector"), [
    "Assurances regarding residents' safety in the event of a fire in the centre were not adequate as follows;",
    "• The inspectors found gaps in the closure of a number of cross-corridor fire doors.",
    "• Intumescent strips were painted over.",
    "• Doors were wedged open.",
    "Staff had completed fire training and knew the evacuation procedures in the centre.",
  ]);
});

// As the live data has them: the splitter's first commitment can start at the top of the form.
test("a commitment drops the form's words at the top, and keeps a bullet within it as •", () => {
  const first =
    "Regulation 9: Residents' rights\nSubstantially Compliant\nOutline how you are going to come into compliance with Regulation 9: Residents' rights:\nCare plans will be reviewed by 15th September 2026.";
  assert.equal(commitment(first, "Regulation 9", "Residents' rights"), "Care plans will be reviewed by 15th September 2026.");
  assert.equal(
    commitment("Checks will include:\n the call-bell\n the alarm, by May 2026.", "Regulation 9", "Residents' rights"),
    "Checks will include: • the call-bell • the alarm, by May 2026.",
  );
  assert.equal(commitment("Regulation 9: Residents' rights", "Regulation 9", "Residents' rights"), "Regulation 9: Residents' rights");
});

// As the live data has them: the PDF repeats the form's heading where a response runs over a page,
// and Word's other bullets (square, tick, dot, diamond) start items too.
test("a response loses the form's heading where the PDF repeats it, and Word's other bullets start items", () => {
  const text = [
    "Regulation 4: Written policies and",
    "procedures",
    "Substantially Compliant",
    "Outline how you are going to come into compliance with Regulation 4: Written policies and procedures:",
    "All policies are being reviewed.",
    "Regulation 4: Written policies and procedures Substantially Compliant",
    `${String.fromCodePoint(0xf0a7)} The fire policy is updated.`,
    `${String.fromCodePoint(0xf0fc)} The complaints policy is updated.`,
    // Repeated without its judgment, then the "Outline how" line on its own.
    "Regulation 4: Written policies and procedures",
    "Outline how you are going to come into compliance with Regulation 4: Written policies and procedures:",
    // A bullet with no space after it.
    `${String.fromCodePoint(0xf0d8)}All staff have read them.`,
  ].join("\n");
  assert.deepEqual(passage(text, "Regulation 4", "Written policies and procedures", "response"), [
    "All policies are being reviewed.",
    "• The fire policy is updated.",
    "• The complaints policy is updated.",
    "• All staff have read them.",
  ]);
  // The provider quoting the regulation itself, after the form's words, is their own words, so it stays.
  const quoting = [
    "Regulation 4: Written policies and procedures",
    "Not Compliant",
    "Outline how you are going to come into compliance with Regulation 4: Written policies and procedures:",
    "Regulation 4: The registered provider shall prepare policies.",
  ].join("\n");
  assert.deepEqual(passage(quoting, "Regulation 4", "Written policies and procedures", "response"), [
    "Regulation 4: The registered provider shall prepare policies.",
  ]);
});

test("a stated deadline drops its bullet and line breaks", () => {
  const base = reports([[28, "Fire precautions", { 1: "substantially-compliant" }]]);
  const deadline = {
    text: "- Works will be completed\nby 31/05/2025.",
    stated_deadline: "2023-05-31",
    stated_deadline_text: "31/05/2025",
    deadline_precision: "day",
    page: 22,
    last_page: 22,
  };
  const promised = finding({ report_id: 1, stated_deadlines: [deadline], re_assessment: { status: "not re-assessed", ...NONE } });
  const result = addFindings(base, [promised]);
  assert.equal(result.highlights[0].text, "“Works will be completed by 31/05/2025.”");
  assert.equal(result.trails[0].promises[0].quote, "Works will be completed by 31/05/2025.");
});

test("no findings leaves the reports as they are", () => {
  const base = reports([]);
  assert.equal(addFindings(base, null), base);
  assert.equal(addFindings(base, []), base);
});

test("a regulation not compliant at the latest inspection gets a highlight and a trail", () => {
  const base = reports([[28, "Fire precautions", { 3: "not-compliant" }]]);
  const result = addFindings(base, [finding({})]);
  assert.equal(result.highlights.length, 1);
  const [highlight] = result.highlights;
  assert.equal(highlight.rule, "not-compliant-latest");
  assert.deepEqual(highlight.dates, ["2025-06-25"]);
  assert.equal(highlight.text, "“The kitchen ductwork had not been cleaned.”");
  assert.deepEqual(highlight.sources, ["Inspector · report pp. 11–12"]);
  assert.equal(highlight.regulation, base.history[0].regulation, "reuses the history table's title");

  const [trail] = result.trails;
  assert.equal(trail.finding.inspectionId, "3");
  assert.deepEqual(trail.finding.source, {
    document: "report",
    page: 11,
    lastPage: 12,
    context: "Inspector",
    url: `${URL_(3)}#page=11`,
  });
  assert.equal(trail.followUp, undefined, "no later report");
});

test("a regulation found at the last inspections in a row traces the finding before the latest", () => {
  const base = reports([[28, "Fire precautions", { 1: "compliant", 2: "substantially-compliant", 3: "not-compliant" }]]);
  const earlier = finding({
    report_id: 2,
    judgment: "Substantially compliant",
    compliance_items: [{ regulation: "Regulation 28(1)(a)", risk_rating: "Yellow", date_to_comply: "2024-10-16" }],
    stated_deadlines: [
      {
        text: "The ductwork will be cleaned by 30/09/2024.",
        stated_deadline: "2024-09-30",
        stated_deadline_text: "30/09/2024",
        deadline_precision: "day",
        page: 18,
        last_page: 18,
      },
    ],
    re_assessment: {
      status: "re-assessed",
      report_id: 3,
      inspection_date: "2025-06-25",
      report_url: URL_(3),
      judgment: "Not Compliant",
      reports_between: 0,
      inspector: { text: "Regulation 28: Fire precautions\nStill not cleaned.\nJudgment: Not compliant", first_page: 9, last_page: 9 },
    },
  });
  const result = addFindings(base, [finding({}), earlier]);
  assert.equal(result.highlights[0].rule, "repeated");
  assert.deepEqual(result.highlights[0].dates, ["2024-08-16", "2025-06-25"]);

  const [trail] = result.trails;
  assert.equal(trail.finding.inspectionId, "2");
  assert.equal(trail.finding.risk, "yellow");
  assert.deepEqual(trail.datesToComply, ["2024-10-16"]);
  assert.deepEqual(
    trail.promises.map(({ label, due, quote }) => ({ label, due, quote })),
    [{ label: "A", due: "30/09/2024", quote: "The ductwork will be cleaned by 30/09/2024." }],
  );
  assert.equal(trail.followUp.inspectionId, "3");
  assert.equal(trail.followUp.judgement, "not-compliant");
  assert.deepEqual(trail.followUp.quotes, ["Still not cleaned."]);
  assert.equal(trail.followUp.between, undefined);
});

test("a promise whose deadline passed with no later judgment is flagged", () => {
  const base = reports([[28, "Fire precautions", { 1: "substantially-compliant" }]]);
  const promised = finding({
    report_id: 1,
    judgment: "Substantially compliant",
    stated_deadlines: [
      {
        text: "Fire doors will be replaced by\nJuly 2023.",
        stated_deadline: "2023-07-31",
        stated_deadline_text: "July 2023",
        deadline_precision: "month",
        page: 15,
        last_page: 15,
      },
    ],
    re_assessment: { status: "not re-assessed", ...NONE },
  });
  const result = addFindings(base, [promised]);
  const [highlight] = result.highlights;
  assert.equal(highlight.rule, "promise-not-rejudged");
  assert.equal(highlight.judgement, "not-assessed");
  assert.deepEqual(highlight.dates, ["2023-05-10", "2025-06-25"]);
  assert.equal(highlight.text, "“Fire doors will be replaced by July 2023.”");

  const [trail] = result.trails;
  assert.equal(trail.followUp.inspectionId, "2", "the first inspection after the finding");
  assert.equal(trail.followUp.judgement, "not-assessed");
  assert.equal(trail.followUp.notAssessedSince, 1);
});

test("an older finding that was later judged compliant gets no highlight", () => {
  const base = reports([[28, "Fire precautions", { 1: "not-compliant", 2: "compliant" }]]);
  const old = finding({ report_id: 1, re_assessment: { ...NONE, status: "re-assessed", report_id: 2, judgment: "Compliant" } });
  assert.deepEqual(addFindings(base, [old]).highlights, []);
});

test("findings of reports not on the timeline are left out", () => {
  const base = reports([[28, "Fire precautions", { 3: "not-compliant" }]]);
  assert.deepEqual(addFindings(base, [finding({ report_id: 99 })]).highlights, []);
});

test("the next judgment is shown as printed when it isn't one of HIQA's three, and ties are flagged", () => {
  const { inspections } = reports([]);
  const regulation = { number: 28, title: "Fire precautions" };
  const odd = toTrail(
    finding({ report_id: 1, re_assessment: { ...NONE, status: "re-assessed", report_id: 3, judgment: "Not applicable", reports_between: 1 } }),
    regulation,
    inspections,
  );
  assert.equal(odd.followUp.judgement, "not-assessed");
  assert.equal(odd.followUp.printedJudgement, "Not applicable");
  assert.equal(odd.followUp.between, 1);

  const tie = toTrail(finding({ report_id: 1, re_assessment: { ...NONE, status: "order unknown" } }), regulation, inspections);
  assert.equal(tie.followUp, undefined);
  assert.equal(tie.orderUnknown, true);
});

test("no trail without the inspector's words", () => {
  const { inspections } = reports([]);
  assert.equal(toTrail(finding({ inspector: null }), { number: 28, title: "Fire precautions" }, inspections), null);
});
