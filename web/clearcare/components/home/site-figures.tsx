// components/home/site-figures.tsx
// What ClearCare currently has: what the site holds, read live from the API on each request. A figure the
// API can't give is left out rather than guessed, as invented figures could be mistaken for real
// ones (lib/statistics.ts); with none, the section isn't shown. On a tinted band the full width of
// the window, so it reads as a section of its own; the news banner after it meets it.
import { fullWidthClass } from "@/components/ui/classes";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";
import { formatDate } from "@/lib/centres";
import type { RegisterSnapshot } from "@/lib/search";
import { formatCount, type ReAssessmentStatistics } from "@/lib/statistics";

type Figure = { value: string; label: string; icon: string };

export function SiteFigures({
  homes,
  snapshot,
  statistics,
}: {
  homes: number | null;
  snapshot: RegisterSnapshot | null;
  statistics: ReAssessmentStatistics | null;
}) {
  const figures: Figure[] = [];
  if (homes !== null) {
    figures.push({ value: formatCount(homes), label: "Registered nursing homes for older people", icon: ICON_PATHS.home });
  }
  if (statistics) {
    const { coverage, matrix } = statistics;
    const results = matrix.reduce((sum, row) => sum + row.total, 0);
    figures.push(
      { value: formatCount(coverage.reports_loaded), label: "Inspection reports", icon: ICON_PATHS.report },
      { value: formatCount(results), label: "Inspection results read", icon: ICON_PATHS.results },
    );
  }
  if (snapshot) {
    figures.push({ value: formatDate(snapshot.fetched_at), label: "Nursing home list last updated", icon: ICON_PATHS.calendar });
  }
  if (statistics) {
    figures.push({ value: formatDate(statistics.data_date), label: "Latest inspection included", icon: ICON_PATHS.inspection });
  }
  if (figures.length === 0) return null;

  return (
    <section aria-labelledby="figures-h" className={`${fullWidthClass} bg-band py-10 md:py-14`}>
      {/* The same width and side padding as the page's column, so the cards line up with it. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:px-8">
        <h2 id="figures-h" className="text-center font-heading text-2xl font-semibold tracking-tight md:text-4xl adult:text-left">
          What ClearCare currently has
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-5">
          {figures.map((figure) => (
            <li
              key={figure.label}
              className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-4 text-center md:p-5"
            >
              <IconCircle path={figure.icon} size="large" />
              <span className="font-heading text-2xl font-semibold text-primary md:text-3xl">{figure.value}</span>
              <span className="text-sm text-ink-muted">{figure.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
