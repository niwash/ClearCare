// app/national/re-assessment.csv/route.ts
// The re-assessment matrix as a CSV: one row per starting judgment, with what the judgments became
// at the centre's next report and the re-check rate.
import { toCsv } from "@/lib/csv";
import { getReAssessmentStatistics, statisticsUnavailableMessage } from "@/lib/statistics";

function formatRate(rate: number | null) {
  return rate === null ? "" : `${(rate * 100).toFixed(1)}%`;
}

export async function GET() {
  const lookup = await getReAssessmentStatistics();
  if (lookup.status === "unavailable") {
    return new Response(statisticsUnavailableMessage(lookup.httpStatus), { status: 503 });
  }
  const { matrix, re_check_rate, data_date } = lookup.statistics;

  const header = [
    // In the page's words (app/(site)/national/page.tsx).
    "Judgment",
    "Next inspection: Compliant",
    "Next inspection: Substantially compliant",
    "Next inspection: Not compliant",
    "Not checked again",
    "No later report yet",
    "Results judged",
    "With a later inspection",
    "Checked again",
    "Share checked again",
  ];
  // The API returns both lists in the same order of starting judgments.
  const rows = matrix.map((row, index) => {
    const reCheck = re_check_rate[index];
    return [
      row.judgment,
      row.compliant,
      row.substantially_compliant,
      row.not_compliant,
      row.not_re_assessed,
      row.no_later_report,
      row.total,
      reCheck.with_later_report,
      reCheck.re_assessed,
      formatRate(reCheck.rate),
    ];
  });

  return new Response(toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="re-assessment-${data_date}.csv"`,
    },
  });
}
