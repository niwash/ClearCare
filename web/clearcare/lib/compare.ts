// lib/compare.ts
// Compare Homes (CCARE-127): the homes a user has saved to compare, at most three, kept in the
// browser's localStorage (components/compare/compare-store.ts) and lined up side by side on
// /compare. Only type imports, so the tests can load this file as it is.
import type { CentreReports, ISODate, Judgement, Regulation } from "./centres";

export const MAX_COMPARED = 3;
export const COMPARE_STORAGE_KEY = "compare-homes";

// The name is saved with the ID so the buttons and the navigation can show the list without
// asking the API.
export interface ComparedHome {
  id: string;
  name: string;
}

const CENTRE_ID = /^\d+$/;

// Whatever is stored, as a list that is safe to use: well-formed entries only, no repeats, at most
// three. Anything unreadable counts as an empty list.
export function parseCompared(raw: string | null): ComparedHome[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  const homes: ComparedHome[] = [];
  for (const entry of value) {
    if (homes.length === MAX_COMPARED) break;
    const { id, name } = (entry ?? {}) as Partial<ComparedHome>;
    if (typeof id !== "string" || !CENTRE_ID.test(id) || typeof name !== "string") continue;
    if (homes.some((home) => home.id === id)) continue;
    homes.push({ id, name });
  }
  return homes;
}

// Added at the end, so the columns keep the order the homes were saved in. A full list, or a home
// already in it, is returned unchanged.
export function addHome(homes: ComparedHome[], home: ComparedHome): ComparedHome[] {
  if (homes.length >= MAX_COMPARED || homes.some((saved) => saved.id === home.id)) return homes;
  return [...homes, home];
}

export function removeHome(homes: ComparedHome[], id: string): ComparedHome[] {
  return homes.filter((home) => home.id !== id);
}

// "/compare?homes=101,34": the page reads the IDs from the address, so the server can fetch them.
export function compareHref(ids: string[]) {
  return ids.length > 0 ? `/compare?homes=${ids.join(",")}` : "/compare";
}

// The IDs in ?homes=, in order: digits only, no repeats, at most three.
export function parseHomesParam(param: string | string[] | undefined): string[] {
  const value = Array.isArray(param) ? param[0] : param;
  const ids: string[] = [];
  for (const id of value?.split(",") ?? []) {
    const trimmed = id.trim();
    if (ids.length === MAX_COMPARED) break;
    if (CENTRE_ID.test(trimmed) && !ids.includes(trimmed)) ids.push(trimmed);
  }
  return ids;
}

type Result = Exclude<Judgement, "not-assessed">;

// As SEVERITY in centres.ts, repeated so this file has no runtime imports.
const SEVERITY: Record<Result, number> = { compliant: 0, "substantially-compliant": 1, "not-compliant": 2 };

// The last judgement a home was given for a regulation, and the inspection it came from.
export interface LatestResult {
  judgement: Result;
  date: ISODate;
}

// One regulation across the compared homes: a result per home, in column order, or null where the
// home's reports in ClearCare never judged it (or it has none).
export interface ComparisonRow {
  regulation: Regulation;
  results: (LatestResult | null)[];
}

// Every regulation any of the homes was judged on. Rows where a home fell short come first, worst
// first, then by regulation number, so the differences are at the top.
export function regulationRows(homes: (CentreReports | null)[]): ComparisonRow[] {
  const rows = new Map<number, ComparisonRow>();
  homes.forEach((reports, column) => {
    for (const history of reports?.history ?? []) {
      const inspection = reports!.inspections.findLast((inspection) => history.results[inspection.id]);
      if (!inspection) continue;
      const row = rows.get(history.regulation.number) ?? { regulation: history.regulation, results: homes.map(() => null) };
      row.results[column] = { judgement: history.results[inspection.id], date: inspection.date };
      rows.set(history.regulation.number, row);
    }
  });

  const worst = (row: ComparisonRow) => Math.max(...row.results.map((result) => (result ? SEVERITY[result.judgement] : -1)));
  return [...rows.values()].sort((a, b) => worst(b) - worst(a) || a.regulation.number - b.regulation.number);
}

// No home fell short on it: each was judged Compliant last time, or never judged on it. These rows
// fold into one line, so the grid shows where the homes differ.
export function compliantWhereverJudged(row: ComparisonRow) {
  return row.results.every((result) => result === null || result.judgement === "compliant");
}

// The latest inspection that judged regulations. Thematic inspections judge none, so they are skipped.
function latestJudged(reports: CentreReports) {
  return reports.inspections.findLast((inspection) => inspection.regulationJudgements);
}

// The regulations the latest inspection with regulation judgements found Not compliant.
export function notCompliantAtLatest(reports: CentreReports): Regulation[] {
  const inspection = latestJudged(reports);
  if (!inspection) return [];
  return reports.history
    .filter((history) => history.results[inspection.id] === "not-compliant")
    .map((history) => history.regulation)
    .sort((a, b) => a.number - b.number);
}

// The issues that came back: Not compliant at each of the last two inspections that judged the
// regulation.
export function repeatedNotCompliant(reports: CentreReports): Regulation[] {
  return reports.history
    .filter((history) => {
      const judged = reports.inspections.filter((inspection) => history.results[inspection.id]);
      return judged.length >= 2 && judged.slice(-2).every((inspection) => history.results[inspection.id] === "not-compliant");
    })
    .map((history) => history.regulation)
    .sort((a, b) => a.number - b.number);
}
