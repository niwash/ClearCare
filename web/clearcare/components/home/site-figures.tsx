// components/home/site-figures.tsx
// What ClearCare currently has: what the site holds, read live from the API on each request. A figure the
// API can't give is left out rather than guessed, as invented figures could be mistaken for real
// ones (lib/statistics.ts); with none, the section isn't shown. On a tinted band the full width of
// the window, so it reads as a section of its own; the news banner after it meets it.
import { fullWidthClass } from "@/components/ui/classes";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS, Icon } from "@/components/ui/icons";
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
  // How current the figures are, as one line under the cards rather than two more cards.
  const dates = [
    snapshot && `Nursing home list updated ${formatDate(snapshot.fetched_at)}`,
    statistics && `latest inspection included ${formatDate(statistics.data_date)}`,
  ].filter(Boolean);
  if (figures.length === 0 && dates.length === 0) return null;

  return (
    <section aria-labelledby="figures-h" className={`${fullWidthClass} bg-band py-8 md:py-10`}>
      {/* The same width and side padding as the page's column, so the cards line up with it. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:px-8">
        <h2 id="figures-h" className="text-center font-heading text-2xl font-semibold tracking-tight md:text-3xl adult:text-left">
          What ClearCare currently has
        </h2>
        {/* One row of cards from tablet width; on phones each card is a short row of its own, the icon
            beside the figure, so the three take less height. */}
        <ul className="reveal grid gap-3 sm:grid-cols-3 md:gap-4">
          {figures.map((figure) => (
            <li
              key={figure.label}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:flex-col sm:gap-2 sm:text-center md:p-5 adult:rounded-lg adult:shadow-none"
            >
              <IconCircle path={figure.icon} size="large" />
              <span className="flex flex-col sm:items-center">
                <span className="font-heading text-2xl font-semibold text-primary md:text-3xl">{figure.value}</span>
                <span className="text-sm text-ink-muted">{figure.label}</span>
              </span>
            </li>
          ))}
        </ul>
        {dates.length > 0 && (
          <p className="flex items-center justify-center gap-2 text-sm text-ink-muted adult:justify-start">
            <Icon name="calendar" />
            {/* Capitalised here, as either part can come first. */}
            <span className="block first-letter:uppercase">{dates.join(", ")}.</span>
          </p>
        )}
      </div>
    </section>
  );
}
