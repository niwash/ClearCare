// lib/judgements.ts
// How a regulation was judged at each inspection. The grid of judgments on the Inspection history
// page and the findings of an inspection's row on the timeline (CCARE-235) both come from
// buildCells, so the two can't disagree on a judgement or on which finding links to its trail. No
// runtime imports, so the tests can load it as it is.
import type { Inspection, Judgement, PromiseTrail, Regulation, RegulationHistory } from "./centres";

type Judged = Exclude<Judgement, "not-assessed">;

// How serious each judgement is, for "same"/"worse"/"better" and for ordering rows.
export const SEVERITY: Record<Judged, number> = {
  compliant: 0,
  "substantially-compliant": 1,
  "not-compliant": 2,
};

export type Change = "same" | "worse" | "better";

// How a judgement compares with the last one given for the same regulation.
export function changeFrom(previous: Judged, current: Judged): Change {
  const difference = SEVERITY[current] - SEVERITY[previous];
  return difference === 0 ? "same" : difference > 0 ? "worse" : "better";
}

export type Cell = {
  judgement: Judgement;
  trail?: PromiseTrail; // this inspection made the finding the trail starts from
};

// A regulation's judgement at each inspection that judged regulations, keyed by inspection id and
// in the inspections' order.
export function buildCells(row: RegulationHistory, inspections: Inspection[], trails: PromiseTrail[]) {
  const rowTrails = trails.filter((trail) => trail.regulation.number === row.regulation.number);
  const cells = new Map<string, Cell>();

  for (const inspection of inspections) {
    if (!inspection.regulationJudgements) continue;
    cells.set(inspection.id, {
      judgement: row.results[inspection.id] ?? "not-assessed",
      trail: rowTrails.find((trail) => trail.finding.inspectionId === inspection.id),
    });
  }
  return cells;
}

// The judgments of a home as a grid (CCARE-235): a row for each regulation, a column for each
// inspection, so a reader sees which regulations keep coming up and which got better.
export interface JudgementGrid {
  // The inspections that judged regulations, oldest first. A thematic inspection judges the
  // National Standards, so it has no column.
  columns: Inspection[];
  // The regulations that were a finding at least once, each with a cell for every column: the most
  // often not compliant first, then the most often substantially compliant, then by number.
  rows: { regulation: Regulation; cells: Cell[] }[];
  // The others, compliant whenever they were judged, by number. A row of them says nothing a line
  // under the grid doesn't.
  rest: Regulation[];
}

export function judgementGrid(history: RegulationHistory[], inspections: Inspection[], trails: PromiseTrail[]): JudgementGrid {
  const columns = inspections.filter((inspection) => inspection.regulationJudgements);
  const rows: JudgementGrid["rows"] = [];
  const rest: Regulation[] = [];

  for (const row of history) {
    const cells = [...buildCells(row, columns, trails).values()];
    if (times(cells, "not-compliant") + times(cells, "substantially-compliant") > 0) rows.push({ regulation: row.regulation, cells });
    else rest.push(row.regulation);
  }

  rows.sort(
    (a, b) =>
      times(b.cells, "not-compliant") - times(a.cells, "not-compliant") ||
      times(b.cells, "substantially-compliant") - times(a.cells, "substantially-compliant") ||
      a.regulation.number - b.regulation.number,
  );
  rest.sort((a, b) => a.number - b.number);
  return { columns, rows, rest };
}

function times(cells: Cell[], judgement: Judgement) {
  return cells.filter((cell) => cell.judgement === judgement).length;
}

// A judgement of substantially compliant or not compliant; a compliant one is not a finding.
export interface InspectionFinding {
  regulation: Regulation;
  judgement: Exclude<Judged, "compliant">;
  trail?: PromiseTrail;
}

export interface InspectionFindings {
  findings: InspectionFinding[]; // not compliant first, then by regulation number
  compliant: number; // regulations judged compliant, which are counted and not named
}

// What one inspection found, each finding as its cell of the grid has it. null when the page holds
// no judgement from that inspection: its report isn't among the inspections, or gave none.
export function inspectionFindings(
  inspectionId: string,
  history: RegulationHistory[],
  inspections: Inspection[],
  trails: PromiseTrail[],
): InspectionFindings | null {
  const findings: InspectionFinding[] = [];
  let compliant = 0;
  for (const row of history) {
    const cell = buildCells(row, inspections, trails).get(inspectionId);
    if (!cell || cell.judgement === "not-assessed") continue;
    if (cell.judgement === "compliant") compliant += 1;
    else findings.push({ regulation: row.regulation, judgement: cell.judgement, trail: cell.trail });
  }
  if (findings.length === 0 && compliant === 0) return null;

  findings.sort((a, b) => SEVERITY[b.judgement] - SEVERITY[a.judgement] || a.regulation.number - b.regulation.number);
  return { findings, compliant };
}

// The most regulations judged not compliant that an inspection's row on the timeline names. Of
// 2,019 inspections 362 have four or more, and the most is 15: named, they run to four lines on a
// desktop and fifteen on a phone. The readers are mostly older and the row is to say the most in
// the fewest words, so past three it says how many there are and leaves the titles to the report.
export const MOST_NOT_COMPLIANT_NAMED = 3;

export function namesNotCompliant(notCompliant: number): boolean {
  return notCompliant <= MOST_NOT_COMPLIANT_NAMED;
}
