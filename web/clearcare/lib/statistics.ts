// lib/statistics.ts
// National statistics from the API. Field names are the API's and stay snake_case. Every count and
// rate comes from the API; the site only formats them.
import type { ISODate } from "./centres";
import { apiUrl } from "./search";

type StartingJudgment = "Compliant" | "Substantially compliant" | "Not compliant";

// GET /statistics/re-assessment (ReAssessmentStatistics in api/openapi.yaml): what each judgment
// became at the centre's next report, one row per starting judgment.
export interface ReAssessmentStatistics {
  matrix: {
    judgment: StartingJudgment;
    compliant: number;
    substantially_compliant: number;
    not_compliant: number;
    not_re_assessed: number;
    no_later_report: number;
    total: number;
  }[];
  re_check_rate: {
    judgment: StartingJudgment;
    with_later_report: number;
    re_assessed: number;
    rate: number | null; // null when no judgment has a later report
  }[];
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
