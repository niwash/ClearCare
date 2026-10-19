import Link from "next/link";
import { Suspense } from "react";
import { SampleCentre, SampleCentreFallback } from "@/components/home/sample-centre";
import { MAX_TEXT_LENGTH, searchCentres } from "@/lib/search";

export default async function StartPage() {
  // No filters and one result per page: only total is needed.
  const count = await searchCentres({ page_size: "1" });
  const total = count.ok ? count.data.total : null;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-[2fr_1fr] md:gap-10">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">
            Check a nursing home&apos;s record
          </h1>
          <p className="text-ink-muted md:text-lg">
            Every HIQA inspection report, one page per home. Every line links back to the report it came from.
          </p>

          {/* Name or Eircode here; the search page works out which. It has address and county too. */}
          <form action="/search" method="GET" role="search" aria-label="Find a nursing home" className="flex gap-2">
            <label htmlFor="start-search" className="sr-only">
              Nursing home name or Eircode
            </label>
            <input
              id="start-search"
              name="q"
              type="search"
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Nursing home name"
              className="h-11 min-w-0 flex-1 rounded-md border border-field bg-surface px-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button type="submit" className="h-11 rounded-md bg-primary px-4 font-semibold text-on-primary transition-opacity hover:opacity-90 adult:transition-none adult:hover:bg-primary-hover adult:hover:opacity-100">
              Search
            </button>
          </form>

          <p className="text-sm">
            <Link href="/search" className="adult:inline-flex adult:min-h-11 adult:items-center">Search by address, town or county instead →</Link>
          </p>

          {total !== null && (
            <p className="text-xs text-ink-muted md:text-sm">
              {total} registered {total === 1 ? "centre" : "centres"}.
            </p>
          )}
        </div>
        <aside className="rounded-lg border border-line bg-surface p-4 text-sm">
          <h2 className="font-semibold">What this site doesn&apos;t do</h2>
          <p className="mt-1 text-ink-muted">
            It doesn&apos;t rate or recommend homes, and it can&apos;t tell you where there&apos;s a free bed. For that,
            ask the home or the hospital social worker.
          </p>
        </aside>
      </div>

      {/* A new home on every load. The page above arrives first; the example streams in. */}
      <Suspense fallback={<SampleCentreFallback />}>
        <SampleCentre total={total} />
      </Suspense>
    </>
  );
}
