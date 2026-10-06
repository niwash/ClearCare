// lib/centres.ts
// What the centre page shows: the register entry from GET /centres/{centre_id}, and what the
// inspection reports say. Dates are ISO strings ("2026-04-10").
// Anything the page can work out itself (latest report, "same"/"worse" labels, links
// between the history table and the promise trails) is derived, not sent.
import { cache } from "react";
import { MOCK_CENTRES, MOCK_SNAPSHOT } from "./mock-centres";
import { SAMPLE_REPORTS, SAMPLE_REPORTS_CENTRE_ID } from "./sample-reports";
import type { CentreSummary, RegisterSnapshot } from "./search";

export type ISODate = string;

export type Judgement = "compliant" | "substantially-compliant" | "not-compliant" | "not-assessed";

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
  publishedDate: ISODate;
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

// GET /centres/{centre_id}: the centre's register entry, the same fields as a search result,
// plus the register snapshot it was read from. The API returns 404 for an unknown ID or a
// centre that isn't on the current register.
export interface CentreDetail extends CentreSummary {
  register_snapshot: RegisterSnapshot;
}

// What the inspection reports say. The API doesn't serve this yet (it needs the report tables),
// so the field names are ours until it does.
export interface CentreReports {
  inspections: Inspection[]; // oldest first
  history: RegulationHistory[];
  highlights: Highlight[];
  visitQuestions: string[];
  trails: PromiseTrail[];
}

// Cached so the page and its metadata make one request between them.
export const getCentre = cache(async (id: string): Promise<CentreDetail | null> => {
  if (!/^\d+$/.test(id)) return null; // centre IDs are digits only
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return mockCentre(id);

  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/centres/${id}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `GET /centres/${id} failed with ${response.status}`);
  }
  return response.json();
});

function mockCentre(id: string): CentreDetail | null {
  const centre = MOCK_CENTRES.find((c) => c.centre_id === id);
  return centre ? { ...centre, register_snapshot: MOCK_SNAPSHOT } : null;
}

// TODO: Call the API once it serves reports. Until then only Elm Hall (34) has any.
export async function getCentreReports(id: string): Promise<CentreReports | null> {
  return id === SAMPLE_REPORTS_CENTRE_ID ? SAMPLE_REPORTS : null;
}

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
