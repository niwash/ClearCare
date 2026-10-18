// lib/statistics.ts
// National statistics from the API. Field names are the API's and stay snake_case. Every count and
// rate comes from the API; the site formats them and works out only the shares it draws.
import type { ISODate, Judgement } from "./centres";
import { apiUrl, unavailableMessage } from "./search";

export type StartingJudgment = "Compliant" | "Substantially compliant" | "Not compliant";

// The site's marker for each starting judgment.
export const STARTING_JUDGEMENTS: Record<StartingJudgment, Exclude<Judgement, "not-assessed">> = {
  Compliant: "compliant",
  "Substantially compliant": "substantially-compliant",
  "Not compliant": "not-compliant",
};

// How many judgments of one starting judgment had each result at the home's next report.
export interface NextResultCounts {
  judgment: StartingJudgment;
  compliant: number;
  substantially_compliant: number;
  not_compliant: number;
  not_re_assessed: number;
  no_later_report: number;
  total: number;
}

export interface ReCheckRate {
  judgment: StartingJudgment;
  with_later_report: number;
  re_assessed: number;
  rate: number | null; // null when no judgment has a later report
}

// GET /statistics/re-assessment (ReAssessmentStatistics in api/openapi.yaml): what each judgment
// became at the centre's next report, one row per starting judgment.
export interface ReAssessmentStatistics {
  matrix: NextResultCounts[];
  re_check_rate: ReCheckRate[];
  coverage: {
    reports_loaded: number;
    centres_with_two_or_more_reports: number;
    reports_paired: number;
    judgments_paired: number;
  };
  data_date: ISODate; // the latest inspection date among the loaded reports
}

export type StatisticsLookup =
  | { status: "found"; statistics: ReAssessmentStatistics }
  | { status: "unavailable"; httpStatus: number }; // e.g. 503 before the first report is loaded

// There are no mock statistics: invented national figures could be mistaken for real ones.
export async function getReAssessmentStatistics(): Promise<StatisticsLookup> {
  const url = apiUrl();
  if (!url) return { status: "unavailable", httpStatus: 0 };

  let response: Response;
  try {
    response = await fetch(`${url}/statistics/re-assessment`, { cache: "no-store" });
  } catch {
    return { status: "unavailable", httpStatus: 0 };
  }
  if (!response.ok) return { status: "unavailable", httpStatus: response.status };
  return { status: "found", statistics: await response.json() };
}

const COUNT = new Intl.NumberFormat("en-IE");
const PERCENT = new Intl.NumberFormat("en-IE", { style: "percent" });

// "3,799"
export function formatCount(count: number) {
  return COUNT.format(count);
}

// "88%". Whole percentages: the counts beside them carry the detail.
export function formatPercent(fraction: number) {
  return PERCENT.format(fraction);
}

// The API answers 503 until a report is loaded, which is not the register's 503.
export function statisticsUnavailableMessage(status: number) {
  return status === 503
    ? "No inspection reports have been loaded yet. Please try again later."
    : unavailableMessage(status);
}
