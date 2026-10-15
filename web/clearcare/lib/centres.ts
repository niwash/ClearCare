// lib/centres.ts
// What the centre page shows: the register entry from GET /centres/{centre_id}, and what the
// inspection reports say. Dates are ISO strings ("2026-04-10").
// Anything the page can work out itself (latest report, "same"/"worse" labels, links
// between the history table and the promise trails) is derived, not sent.
import { cache } from "react";
import { MOCK_CENTRES, MOCK_SNAPSHOT } from "./mock-centres";
import { SAMPLE_REPORTS, SAMPLE_REPORTS_CENTRE_ID } from "./sample-reports";
import { apiUrl, mockDataEnabled, type CentreSummary, type RegisterSnapshot } from "./search";

export type ISODate = string;

export type Judgement = "compliant" | "substantially-compliant" | "not-compliant" | "not-assessed";

// How serious each judgement is, for "same"/"worse"/"better" and for ordering rows.
export const SEVERITY: Record<Exclude<Judgement, "not-assessed">, number> = {
  compliant: 0,
  "substantially-compliant": 1,
  "not-compliant": 2,
};

export interface Regulation {
  number: number;
  title: string;
}

// Where a line came from, e.g. "Inspector · report p. 10".
export interface SourceRef {
  document: "report" | "plan";
  page: number;
  context?: string;
  url?: string;
}

export interface Inspection {
  id: string;
  date: ISODate;
  type: string; // as HIQA labels it: "Unannounced", "Announced", "Thematic"…
  publishedDate?: ISODate; // the API doesn't serve it yet
  reportUrl: string;
  // Thematic inspections are judged against the National Standards, so they have no
  // regulation judgements. The summary is shown in their column instead.
  regulationJudgements: boolean;
  summary?: string;
}

export interface RegulationHistory {
  regulation: Regulation;
  // Keyed by inspection id. A missing entry means not assessed at that inspection.
  results: Record<string, Exclude<Judgement, "not-assessed">>;
}

export type HighlightRule = "not-compliant-latest" | "repeated" | "promise-not-rejudged";

export interface Highlight {
  rule: HighlightRule;
  judgement: Judgement; // latest judgement, for the marker
  dates: ISODate[];
  regulation: Regulation;
  text: string; // the inspector's or the provider's own words
  sources: string[];
  reportUrl?: string;
}

export interface CompliancePromise {
  label: string; // "A", "B"…
  title: string;
  quote: string;
  due: string; // as written in the plan: "25 Jul 2025", "Q2 2026"
  source: SourceRef;
}

export type PromiseStatus = "done" | "in-progress" | "not-done";

export interface PromiseUpdate {
  promiseLabel: string;
  status: PromiseStatus;
  quote: string;
  source: SourceRef;
}

export interface PromiseTrail {
  regulation: Regulation;
  finding: {
    inspectionId: string;
    judgement: Judgement;
    risk?: string;
    quotes: string[];
    source: SourceRef;
  };
  promises: CompliancePromise[];
  planNote?: string;
  followUp?: {
    inspectionId: string;
    judgement: Judgement;
    updates: PromiseUpdate[];
  };
}

// GET /centres/{centre_id} (CentreResult in api/openapi.yaml): the centre's register entry, the
// same fields as a search result, and the register snapshot it was read from. The API returns 404
// for an unknown ID or a centre that isn't on the current register.
interface CentreResult {
  centre: CentreSummary;
  register_snapshot: RegisterSnapshot;
}

// What the page uses: the centre with its snapshot alongside, flattened from CentreResult.
export interface CentreDetail extends CentreSummary {
  register_snapshot: RegisterSnapshot;
}

// What the inspection reports say, built from GET /centres/{centre_id}/reports and
// GET /reports/{report_id}. The API has no quoted text yet, so from it highlights,
// visitQuestions and trails are empty; only the sample reports fill them.
export interface CentreReports {
  inspections: Inspection[]; // oldest first
  history: RegulationHistory[];
  highlights: Highlight[];
  visitQuestions: string[];
  trails: PromiseTrail[];
}

export type CentreLookup =
  | { status: "found"; centre: CentreDetail }
  | { status: "not-found" }
  | { status: "unavailable"; httpStatus: number }; // e.g. 503 before the register is loaded

// Cached so the page and its metadata make one request between them.
export const getCentre = cache(async (id: string): Promise<CentreLookup> => {
  if (!/^\d+$/.test(id)) return { status: "not-found" }; // centre IDs are digits only
  if (mockDataEnabled()) return mockCentre(id);
  const url = apiUrl();
  if (!url) return { status: "unavailable", httpStatus: 0 };

  let response: Response;
  try {
    response = await fetch(`${url}/centres/${id}`, { cache: "no-store" });
  } catch {
    return { status: "unavailable", httpStatus: 0 };
  }
  if (response.status === 404) return { status: "not-found" };
  if (!response.ok) return { status: "unavailable", httpStatus: response.status };
  const { centre, register_snapshot }: CentreResult = await response.json();
  return { status: "found", centre: { ...centre, register_snapshot } };
});

function mockCentre(id: string): CentreLookup {
  const centre = MOCK_CENTRES.find((c) => c.centre_id === id);
  return centre ? { status: "found", centre: { ...centre, register_snapshot: MOCK_SNAPSHOT } } : { status: "not-found" };
}

// GET /centres/{centre_id}/reports (CentreReportsResult in api/openapi.yaml), newest first.
interface CentreReportsResult {
  centre_id: string;
  reports: { report_id: number; inspection_date: ISODate | null }[];
}

// GET /reports/{report_id} (ReportResult in api/openapi.yaml), only the fields the page uses.
interface ReportResult {
  report: {
    report_id: number;
    inspection_type: string | null;
    inspection_date: ISODate | null;
    report_file: { url: string };
    regulations: { regulation: string; title: string; judgment: string }[];
  };
}

// The reports serve judgments as the PDFs print them, in either case ("Not compliant",
// "Not Compliant"). Anything else counts as not assessed.
function toJudgement(judgment: string): Exclude<Judgement, "not-assessed"> | undefined {
  switch (judgment.trim().toLowerCase().replace(/\s+/g, " ")) {
    case "compliant":
      return "compliant";
    case "substantially compliant":
      return "substantially-compliant";
    case "not compliant":
      return "not-compliant";
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// null when the home has no reports in ClearCare, or they can't be read right now; the page
// then points to hiqa.ie. With USE_MOCK_DATA=true, Elm Hall (34) has the wireframe's sample reports.
export const getCentreReports = cache(async (id: string): Promise<CentreReports | null> => {
  if (mockDataEnabled()) return id === SAMPLE_REPORTS_CENTRE_ID ? SAMPLE_REPORTS : null;
  const url = apiUrl();
  if (!url) return null;

  const list = await fetchJson<CentreReportsResult>(`${url}/centres/${id}/reports`);
  // A report without an inspection date can't go on the timeline.
  const listed = list?.reports.filter((report) => report.inspection_date) ?? [];
  if (listed.length === 0) return null;

  const results = await Promise.all(listed.map((report) => fetchJson<ReportResult>(`${url}/reports/${report.report_id}`)));
  // A report that can't be read is left out; the rest of the history still shows.
  const reports = results
    .filter((result): result is ReportResult => result !== null)
    .map((result) => result.report)
    .reverse(); // oldest first
  if (reports.length === 0) return null;

  const inspections: Inspection[] = reports.map((report) => ({
    id: String(report.report_id),
    date: report.inspection_date!,
    type: report.inspection_type ?? "Inspection",
    reportUrl: report.report_file.url,
    regulationJudgements: report.regulations.length > 0,
  }));

  // One row per regulation number, titled as the latest report words it.
  const rows = new Map<number, RegulationHistory>();
  for (const report of reports) {
    for (const { regulation, title, judgment } of report.regulations) {
      const number = Number(regulation.match(/\d+/)?.[0]);
      const result = toJudgement(judgment);
      if (!number || !result) continue;
      const row = rows.get(number) ?? { regulation: { number, title }, results: {} };
      row.regulation.title = title;
      row.results[String(report.report_id)] = result;
      rows.set(number, row);
    }
  }

  // Most recently assessed first, worst first within an inspection, so the short list shows what
  // the latest inspection found before older findings.
  const lastAssessed = (row: RegulationHistory) => inspections.findLastIndex((inspection) => row.results[inspection.id]);
  const lastSeverity = (row: RegulationHistory) => SEVERITY[row.results[inspections[lastAssessed(row)].id]];
  const history = [...rows.values()].sort(
    (a, b) =>
      lastAssessed(b) - lastAssessed(a) ||
      lastSeverity(b) - lastSeverity(a) ||
      a.regulation.number - b.regulation.number,
  );

  return { inspections, history, highlights: [], visitQuestions: [], trails: [] };
});

const DAY = new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-IE", { month: "short", year: "numeric", timeZone: "UTC" });

// "10 Apr 2026". en-IE writes "Sept", so trim it to match the other months.
export function formatDate(date: ISODate) {
  return DAY.format(new Date(date)).replace("Sept", "Sep");
}

export function formatMonth(date: ISODate) {
  return MONTH.format(new Date(date)).replace("Sept", "Sep");
}

export function formatSource({ document, page, context }: SourceRef) {
  return `${context ? `${context} · ` : ""}${document} p. ${page}`;
}

export function trailAnchor(regulation: Regulation) {
  return `reg-${regulation.number}`;
}
