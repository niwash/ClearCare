// lib/centres.ts
// What the centre page shows: the register entry from GET /centres/{centre_id}, and what the
// inspection reports say. Dates are ISO strings ("2026-04-10").
// Anything the page can work out itself (latest report, "same"/"worse" labels, links
// between the history table and the promise trails) is derived, not sent.
import { cache } from "react";
import { toJudgement, type CentreFindingsResult, type Finding } from "./findings";
import { apiUrl, type CentreSummary, type RegisterSnapshot } from "./search";

export type ISODate = string;

export type Judgement = "compliant" | "substantially-compliant" | "not-compliant" | "not-assessed";

// How serious each judgement is, for "same"/"worse"/"better" and for ordering rows.
export const SEVERITY: Record<Exclude<Judgement, "not-assessed">, number> = {
  compliant: 0,
  "substantially-compliant": 1,
  "not-compliant": 2,
};

export type Change = "same" | "worse" | "better";

// How a judgement compares with the last one given for the same regulation.
export function changeFrom(previous: Exclude<Judgement, "not-assessed">, current: Exclude<Judgement, "not-assessed">): Change {
  const difference = SEVERITY[current] - SEVERITY[previous];
  return difference === 0 ? "same" : difference > 0 ? "worse" : "better";
}

export interface Regulation {
  number: number;
  title: string;
}

// Where a line came from, e.g. "Inspector · report p. 10" or "report pp. 10–11".
export interface SourceRef {
  document: "report" | "plan";
  page: number;
  lastPage?: number; // when the passage runs onto later pages
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

// A commitment in the provider's response that states a deadline, as written (lib/findings.ts).
export interface CompliancePromise {
  label: string; // "A", "B"…
  title?: string;
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
  // The provider's whole response, when no commitment in it states a deadline.
  response?: { quotes: string[]; source: SourceRef };
  datesToComply?: ISODate[]; // from the compliance plan's own table
  // When the regulation was next judged (ADR-0024), or the first later inspection when none did.
  followUp?: {
    inspectionId: string;
    date?: ISODate; // for a report that isn't on the timeline
    judgement: Judgement;
    printedJudgement?: string; // as printed, when it isn't one of HIQA's three
    quotes?: string[];
    source?: SourceRef;
    between?: number; // inspections in between that didn't assess the regulation
    notAssessedSince?: number; // later inspections that didn't assess it either
    updates: PromiseUpdate[];
  };
  // Two reports share the date the regulation was next judged, so which came first isn't known.
  orderUnknown?: boolean;
}

// "public" for a public nursing home, "private" for a private or voluntary one (CCARE-133).
export type HomeType = "public" | "private";

export const HOME_TYPE_LABELS: Record<HomeType, string> = {
  public: "Public",
  private: "Private or voluntary",
};

// GET /centres/{centre_id} (CentreResult in api/openapi.yaml): the centre's register entry, the
// fields of a search result and the centre's phone, the register snapshot it was read from, and
// the latest Fair Deal contract price with the kind of home it is for.
// The API returns 404 for an unknown ID or a centre that isn't on the current register.
interface CentreResult {
  centre: Omit<CentreDetail, "register_snapshot" | "contract_price" | "home_type">;
  register_snapshot: RegisterSnapshot;
  contract_price?: number | null;
  home_type?: HomeType | null;
}

// What the page uses: the centre with its snapshot and price alongside, flattened from CentreResult.
export interface CentreDetail extends CentreSummary {
  // The centre's own line, as the register prints it: usually one number, sometimes "TBC" or two
  // ("01 555 0123 / 01 555 0124"). null when the register gives none. Missing from an API without
  // CCARE-118 (PR #72), so the page leaves the row out rather than saying "Not stated".
  centre_phone?: string | null;
  register_snapshot: RegisterSnapshot;
  // The newest contract price the HSE published for the home, in euro per resident per week, and
  // whether it came from the public or the private list (CCARE-76, CCARE-133). null when no list
  // has been loaded for it; missing from an API without them, so the page leaves the rows out.
  contract_price?: number | null;
  home_type?: HomeType | null;
}

// A weekly price in euro: whole euros when it has no cents, as the HSE's lists mostly are.
export function formatWeeklyPrice(price: number) {
  const cents = !Number.isInteger(price);
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(price);
}

// How to show a centre's phone: a tap-to-call link for one number, anything else as printed, and
// "Not stated" for none or HIQA's "TBC" placeholder. null when the API doesn't send the field.
export function centrePhone(printed: string | null | undefined): { text: string; tel?: string } | null {
  if (printed === undefined) return null;
  const value = printed?.trim();
  if (!value || /^tbc$/i.test(value)) return { text: "Not stated" };
  const digits = value.replace(/[\s()-]/g, "");
  return /^\+?\d{7,13}$/.test(digits) ? { text: value, tel: digits } : { text: value };
}

// What the inspection reports say, built from GET /centres/{centre_id}/reports and
// GET /reports/{report_id}. getCentreReports leaves highlights and trails empty; the centre page
// adds them from getCentreFindings with addFindings (lib/findings.ts). visitQuestions stays
// empty: nothing in the API says what to ask.
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
  const { centre, register_snapshot, contract_price, home_type }: CentreResult = await response.json();
  return { status: "found", centre: { ...centre, register_snapshot, contract_price, home_type } };
});

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

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// null when the home has no reports in ClearCare, or they can't be read right now; the page
// then points to hiqa.ie.
export const getCentreReports = cache(async (id: string): Promise<CentreReports | null> => {
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

// GET /centres/{centre_id}/findings (CCARE-206): each finding with the inspector's and the
// provider's words and when the regulation was next judged. null when it can't be read, including
// from an API without the endpoint; the page then shows no highlights or trails, as before.
export const getCentreFindings = cache(async (id: string): Promise<Finding[] | null> => {
  const url = apiUrl();
  if (!url) return null;
  const result = await fetchJson<CentreFindingsResult>(`${url}/centres/${id}/findings`);
  return Array.isArray(result?.findings) ? result.findings : null;
});

// A passage of the report that supports an amenity: its exact words, as the AI tool quoted them
// (not checked), and the pages it spans, counted from the PDF's first page, cover included.
export interface AmenityEvidence {
  quote: string;
  page_start: number;
  page_end: number; // the same as page_start for a passage on one page
}

// One item from the extractor's fixed list ("Respite care", "Garden"), with at least one passage.
export interface AmenityItem {
  item: string;
  evidence: AmenityEvidence[];
}

// What the home offers, as an AI tool (gpt-4o-mini) read it from one inspection report: from
// GET /centres/{centre_id}/amenities?version=amenities-v2 (CentreAmenitiesV2 in api/openapi.yaml,
// docs/amenities.md, CCARE-195). Not yet checked against the reports. A list only has what the
// report supports directly, so an item missing from it isn't confirmed, not known to be absent.
export interface CentreAmenities {
  report_id: number;
  inspection_date: ISODate | null;
  care_types: AmenityItem[];
  room_types: AmenityItem[];
  activities: AmenityItem[];
  facilities: AmenityItem[];
  extractor_version: string;
  model: string;
}

interface CentreAmenitiesResult {
  centre_id: string;
  amenities: CentreAmenities | null;
}

const AMENITIES_VERSION = "amenities-v2";

// null when nothing has been read from the home's reports yet, or it can't be read right now. An
// API from before CCARE-195 ignores the version and answers in the v1 shape, so that counts as none.
export const getCentreAmenities = cache(async (id: string): Promise<CentreAmenities | null> => {
  const url = apiUrl();
  if (!url) return null;
  const result = await fetchJson<CentreAmenitiesResult>(`${url}/centres/${id}/amenities?version=${AMENITIES_VERSION}`);
  const amenities = result?.amenities;
  return amenities?.extractor_version === AMENITIES_VERSION ? amenities : null;
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

export function formatSource({ document, page, lastPage, context }: SourceRef) {
  const pages = lastPage && lastPage > page ? `pp. ${page}–${lastPage}` : `p. ${page}`;
  return `${context ? `${context} · ` : ""}${document} ${pages}`;
}

export function trailAnchor(regulation: Regulation) {
  return `reg-${regulation.number}`;
}
