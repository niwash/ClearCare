import Link from "next/link";
import { Suspense } from "react";
import { FeatureCarousel } from "@/components/home/feature-carousel";
import { NewsBanner } from "@/components/home/news-banner";
import { SampleCentre, SampleCentreFallback } from "@/components/home/sample-centre";
import { primaryButtonClass, textInputClass } from "@/components/ui/classes";
import { MAX_TEXT_LENGTH, searchCentres } from "@/lib/search";

export default async function StartPage() {
  // No filters and one result per page: only total is needed.
  const count = await searchCentres({ page_size: "1" });
  const total = count.ok ? count.data.total : null;

  return (
    <>
      <FeatureCarousel />

      {/* The page's h1: who the site is for, what it does and what it is for, before any task. A
          tinted band the full width of the window, set apart from the rest of the page, with the
          words centred. The adult-centred design keeps them left-aligned, which is easier to read
          (NIA/NLM: left-justify text). */}
      {/* md:-mt-12 cancels the page's gap between sections, so on wider screens the band starts
          where the carousel ends. */}
      <section className="mx-[calc(50%-50vw)] w-screen bg-band px-4 py-10 md:-mt-12 md:px-8 md:py-16 adult:md:mt-0">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center adult:items-start adult:text-left">
          <div className="flex max-w-3xl flex-col items-center gap-4 adult:items-start">
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">Welcome to ClearCare</h1>
            <p className="md:text-lg">
              Choosing a nursing home is a big decision, for the person moving in and for their family. We bring
              together the information you need to choose a nursing home and explain it in a way that is easy to
              understand.
            </p>
          </div>

          {/* Side by side from tablet width, stacked on phones. */}
          <div className="grid w-full gap-4 md:grid-cols-2 md:gap-6">
            <StatementCard label="Our mission">
              To help people make informed decisions, and give informed consent, about nursing home care.
            </StatementCard>
            <StatementCard label="Our vision">
              As Ireland&apos;s older population grows, more families will face this choice. We want every one of
              them to make it informed and prepared.
            </StatementCard>
          </div>
        </div>
      </section>

      <NewsBanner />

      <div className="grid gap-6 md:grid-cols-[3fr_1fr] md:gap-10">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-4xl">
            Check a nursing home&apos;s record
          </h2>
          {/* The count comes from the API; without it the sentence still reads. */}
          <p className="text-ink-muted md:text-lg">
            We put every publicly available HIQA inspection report for{" "}
            {total !== null ? `${total} registered ${total === 1 ? "centre" : "centres"}` : "each registered centre"} on
            one page per home, so you can see how each has done over time, with links to the original reports. Our
            guides explain each step, from the first conversation to moving in.
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
              className={`${textInputClass} flex-1`}
            />
            <button type="submit" className={primaryButtonClass}>
              Search
            </button>
          </form>

          <p className="text-sm">
            <Link href="/search" className="tap-target">Search by address or county instead →</Link>
          </p>
        </div>
        {/* self-start: as tall as its words, not stretched to the height of the search column. */}
        <aside className="self-start rounded-lg border border-line bg-surface p-3 text-sm">
          <h2 className="font-semibold">What this site doesn&apos;t do</h2>
          <p className="mt-1 text-ink-muted">
            It doesn&apos;t rate or recommend homes, or show free beds. For beds, ask the home or a hospital social
            worker.
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

// One of the mission and vision cards in the welcome band: the title as the card's heading, in the
// accent colour, then the statement as plain body text under it. White cards on the tinted band.
function StatementCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6 md:p-8">
      <h2 className="font-heading text-2xl font-semibold text-primary md:text-3xl">{label}</h2>
      <p className="text-ink-muted md:text-lg">{children}</p>
    </div>
  );
}
