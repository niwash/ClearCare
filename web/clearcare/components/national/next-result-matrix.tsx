// components/national/next-result-matrix.tsx
// What each judgment became at the home's next report, as a shaded table: a row per starting
// judgment, a column per result. The table is its own text alternative. Below md, where the table
// would need to scroll sideways, each starting judgment is a closed section that opens to list its
// results instead, shaded the same way.
import { JudgementIcon } from "@/components/centre/judgement-icon";
import type { Judgement } from "@/lib/centres";
import { formatCount, formatPercent, STARTING_JUDGEMENTS, type NextResultCounts } from "@/lib/statistics";

const COLUMNS: { key: keyof Omit<NextResultCounts, "judgment" | "total">; label: string; judgement?: Judgement }[] = [
  { key: "compliant", label: "Compliant", judgement: "compliant" },
  { key: "substantially_compliant", label: "Substantially compliant", judgement: "substantially-compliant" },
  { key: "not_compliant", label: "Not compliant", judgement: "not-compliant" },
  { key: "not_re_assessed", label: "Not checked again", judgement: "not-assessed" },
  { key: "no_later_report", label: "No later report yet" },
];

// One hue, from the surface to --shade-max of the primary colour. Any more and ink text on the
// cell falls below 4.5:1 contrast in the dark theme, or below 7:1 in the adult-centred design.
function shade(share: number) {
  return `color-mix(in oklab, var(--primary) calc(var(--shade-max) * ${share.toFixed(2)}), var(--surface))`;
}

export function NextResultMatrix({ matrix }: { matrix: NextResultCounts[] }) {
  return (
    <div className="[--shade-max:50%] adult:[--shade-max:30%]">
      <ResultCards matrix={matrix} />
      {/* Equal columns where they are wide enough for "Substantially"; below that, each column is as
          wide as its longest word, so the headings don't run into each other. */}
      <table className="hidden w-full border-collapse text-left text-sm md:table lg:table-fixed">
        <caption className="sr-only">What each judgment became at the home&apos;s next report</caption>
        <colgroup>
          <col className="w-[8.5rem] md:w-[11rem]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line-soft align-bottom">
            <th scope="col" className="py-2 pr-3 text-xs font-normal uppercase tracking-wide text-ink-muted adult:normal-case adult:tracking-normal">
              Judgment
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="px-2 py-2 font-normal leading-snug">
                {column.judgement && (
                  <span className="mb-1 block">
                    <JudgementIcon judgement={column.judgement} size={12} />
                  </span>
                )}
                {column.label}
              </th>
            ))}
            <th scope="col" className="py-2 pl-2 text-right font-normal">
              Results judged
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            // No top border on the first row's cells: in a collapsed table their 2px border would
            // win over the header's 1px divider and hide it above the shaded cells.
            <tr key={row.judgment} className="[&:first-child>td]:border-t-0">
              <th scope="row" className="py-3 pr-3 font-normal">
                <span className="flex items-center gap-2">
                  <JudgementIcon judgement={STARTING_JUDGEMENTS[row.judgment]} />
                  {row.judgment}
                </span>
              </th>
              {COLUMNS.map((column) => {
                const share = row.total > 0 ? row[column.key] / row.total : 0;
                return (
                  // The surface-coloured border keeps a gap between neighbouring shaded cells.
                  <td key={column.key} className="border-2 border-surface px-2 py-3" style={{ backgroundColor: shade(share) }}>
                    <span className="block font-medium">{row.total > 0 ? formatPercent(share) : "–"}</span>
                    <span className="block text-xs tabular-nums">{formatCount(row[column.key])}</span>
                  </td>
                );
              })}
              <td className="py-3 pl-2 text-right tabular-nums">{formatCount(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The phone layout: one closed section per starting judgment, opening to its results one under
// another, so the three fit on a screen until one is opened. The same <details> pattern as the
// contacts page: no script, and find-in-page still opens it.
function ResultCards({ matrix }: { matrix: NextResultCounts[] }) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {matrix.map((row) => (
        <li key={row.judgment}>
          <details className="group overflow-hidden rounded-md border border-line-soft open:border-primary">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <h3 className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                <JudgementIcon judgement={STARTING_JUDGEMENTS[row.judgment]} />
                {row.judgment}
                <span className="text-sm font-normal text-ink-muted">
                  · {formatCount(row.total)} results judged
                </span>
              </h3>
              {/* Points right when closed and down when open. */}
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-90"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </summary>
            <ul>
              {COLUMNS.map((column) => {
                const share = row.total > 0 ? row[column.key] / row.total : 0;
                return (
                  // The surface-coloured border keeps a gap between neighbouring shaded results.
                  <li
                    key={column.key}
                    className="flex items-center justify-between gap-3 border-t-2 border-surface px-3 py-2.5 text-sm"
                    style={{ backgroundColor: shade(share) }}
                  >
                    <span className="flex items-center gap-2">
                      {column.judgement ? (
                        <JudgementIcon judgement={column.judgement} size={12} />
                      ) : (
                        <span aria-hidden className="w-3" />
                      )}
                      {column.label}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-medium">{row.total > 0 ? formatPercent(share) : "–"}</span>{" "}
                      <span className="text-xs tabular-nums">({formatCount(row[column.key])})</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}
