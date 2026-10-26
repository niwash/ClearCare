// app/national/page.tsx
// What each judgment became at the home's next inspection report, across every report ClearCare
// has loaded. The figures come from GET /statistics/re-assessment; the page only draws them.
import { JudgementIcon } from "@/components/centre/judgement-icon";
import { Alert } from "@/components/layout/alert";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Section } from "@/components/layout/section";
import { BarList } from "@/components/national/bar-list";
import { NextResultMatrix } from "@/components/national/next-result-matrix";
import { formatDate, type ISODate } from "@/lib/centres";
import {
  formatCount,
  formatPercent,
  getReAssessmentStatistics,
  statisticsUnavailableMessage,
  STARTING_JUDGEMENTS,
  type ReAssessmentStatistics,
} from "@/lib/statistics";
import { connection } from "next/server";
import type { ReactNode } from "react";

export const metadata = { title: "National figures" };

export default async function NationalPage() {
  // Read the figures on each request. Otherwise the build prerenders the page once, and a build
  // without API_URL would serve "unavailable" until the next build.
  await connection();
  const lookup = await getReAssessmentStatistics();

  return (
    <>
      <div className="flex max-w-3xl flex-col items-start gap-3">
        <Breadcrumb trail={[]} current="National Figures" />
        <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">
          Re-assessment at the next inspection
        </h1>
        <p className="text-ink-muted md:text-lg">
          For every regulation judged in an inspection report, these figures show what the same home&apos;s next
          report found for it. They cover all reports ClearCare has loaded and say nothing about any one home.
        </p>
      </div>

      {lookup.status === "found" ? (
        <NationalFigures statistics={lookup.statistics} />
      ) : (
        // The same message the centre page shows when its record can't be read.
        <Alert title="These figures aren't available right now">{statisticsUnavailableMessage(lookup.httpStatus)}</Alert>
      )}

      <p className="text-small leading-relaxed text-ink-muted">
        Contains information from HIQA inspection reports, reused under the Irish PSI licence (CC BY 4.0). ClearCare
        does not rate or recommend homes.
      </p>
    </>
  );
}

function NationalFigures({ statistics }: { statistics: ReAssessmentStatistics }) {
  const { matrix, re_check_rate, coverage, data_date } = statistics;
  // Each n is the population its chart plots.
  const judgments = matrix.reduce((sum, row) => sum + row.total, 0);
  const judgmentsWithLaterReport = re_check_rate.reduce((sum, row) => sum + row.with_later_report, 0);

  return (
    <>
      <Section
        title="Next result by starting judgment"
        description="Rows: the judgment in a report. Columns: what the home's next report found for the same regulation. Shading follows each row's share."
      >
        <Chart
          note={
            // The exclusions are the view's and the API's (ADR-0015, NextResultCounts in api/openapi.yaml).
            <ChartNote count={`${formatCount(judgments)} judgments`} dataDate={data_date}>
              Reports without a date or with two reports on the next date are left out. A next result printed in
              another spelling counts in the total but in none of the five columns.{" "}
            </ChartNote>
          }
        >
          <NextResultMatrix matrix={matrix} />
        </Chart>
      </Section>

      <div className="grid gap-8 md:gap-12 lg:grid-cols-2">
        <Section
          title="Re-check rate by starting judgment"
          description="Among judgments with a later report, the share that the next report judged again."
        >
          <Chart
            note={
              <ChartNote
                count={`${formatCount(judgmentsWithLaterReport)} judgments with a later report`}
                dataDate={data_date}
              />
            }
          >
            <BarList
              rows={re_check_rate.map((row) => ({
                label: (
                  <span className="flex items-center gap-2">
                    <JudgementIcon judgement={STARTING_JUDGEMENTS[row.judgment]} />
                    {row.judgment}
                  </span>
                ),
                fraction: row.rate,
                value:
                  row.rate === null
                    ? "No later report yet"
                    : `${formatPercent(row.rate)} · ${formatCount(row.re_assessed)} of ${formatCount(row.with_later_report)}`,
              }))}
            />
          </Chart>
        </Section>

        <Section title="Coverage" description="A home needs two loaded reports before its judgments can be followed.">
          <Chart note={<ChartNote count={`${formatCount(coverage.reports_loaded)} reports loaded`} dataDate={data_date} />}>
            {/* Every bar is on the scale of the reports loaded. Judgments are shown as a number only:
                a report holds many, so on that scale the bar would run off the chart, and on a
                scale of its own it would look like 100%. */}
            <BarList
              rows={[
                {
                  label: "Reports loaded",
                  fraction: 1,
                  value: formatCount(coverage.reports_loaded),
                },
                {
                  label: "Homes with two or more reports",
                  fraction: coverage.centres_with_two_or_more_reports / coverage.reports_loaded,
                  value: formatCount(coverage.centres_with_two_or_more_reports),
                },
                {
                  label: "Reports with a next report",
                  fraction: coverage.reports_paired / coverage.reports_loaded,
                  value: formatCount(coverage.reports_paired),
                },
                {
                  label: "Judgments followed",
                  fraction: null,
                  value: formatCount(coverage.judgments_paired),
                },
              ]}
            />
          </Chart>
        </Section>
      </div>
    </>
  );
}

function Chart({ note, children }: { note: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 md:p-6">
      {children}
      {note}
    </div>
  );
}

function ChartNote({ count, dataDate, children }: { count: string; dataDate: ISODate; children?: ReactNode }) {
  return (
    <p className="text-small leading-relaxed text-ink-muted">
      n = {count}. {children}Not re-assessed: the regulation does not appear in the next report ClearCare holds;
      thematic reports are not read. Latest inspection {formatDate(dataDate)}.{" "}
      <a href="/national/re-assessment.csv">Download the figures (CSV)</a>
    </p>
  );
}
