// components/centre/record-loading.tsx
// What a home's record shows while it loads (CCARE-212), from search or any other page: the outline
// of its name, tabs and first cards, on the same bands, with a spinner and words saying it is
// loading. Next.js shows it the moment a link to a home is clicked, and fetches it ahead for links
// on screen (centres/loading.tsx), so the click is answered at once rather than the old page
// staying put. The record then takes its place.
import { fullWidthClass } from "@/components/ui/classes";
import { Band } from "./centre-band";

const block = "rounded-2xl bg-surface-muted motion-safe:animate-pulse adult:rounded-lg";

export function RecordLoading() {
  return (
    <div role="status" className="contents">
      <section aria-hidden className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
        <div className="page-column flex flex-col gap-5 px-4 pt-6 md:px-8 md:pt-8">
          <div className="flex flex-col gap-3">
            <div className={`${block} h-4 w-56 max-w-full`} />
            <div className={`${block} h-10 w-[28rem] max-w-full`} />
          </div>
          <div className="flex items-end gap-1.5 border-b border-line pt-1">
            <div className="h-12 w-28 rounded-t-xl border border-b-0 border-line bg-page adult:rounded-t-md" />
            <div className="h-11 w-40 rounded-t-xl border border-b-0 border-line bg-surface-muted max-sm:hidden adult:rounded-t-md" />
            <div className="h-11 w-36 rounded-t-xl border border-b-0 border-line bg-surface-muted max-md:hidden adult:rounded-t-md" />
          </div>
        </div>
      </section>
      <div className="-mt-6 md:-mt-8">
        <Band tint="page">
          <div className="flex min-h-[60vh] flex-col gap-4">
            <p className="flex items-center gap-3 text-ink-muted">
              <span
                aria-hidden
                className="loading-spinner size-5 shrink-0 rounded-full border-2 border-current border-t-transparent"
              />
              Loading this home&apos;s record…
            </p>
            <div aria-hidden className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className={`${block} aspect-[4/3] lg:aspect-auto lg:h-80`} />
              <div className={`${block} h-48 lg:h-80`} />
            </div>
          </div>
        </Band>
      </div>
    </div>
  );
}
