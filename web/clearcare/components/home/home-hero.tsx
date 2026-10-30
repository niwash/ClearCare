// components/home/home-hero.tsx
// Under the carousel: who ClearCare is for and what it does, spoken to the person reading, with the
// search right there as the first thing they can do, beside a card of why they can rely on it
// (CCARE-179). The page's h1 is here. No photo of its own, as the carousel above has them. The
// search was at the foot of the page before; a family arriving with a home in mind shouldn't have
// to scroll past everything else to reach it. Both columns slide up as the page opens, the card a
// moment after the words (CCARE-186).
import Link from "next/link";
import { eyebrowClass, primaryButtonClass, secondaryLinkClass, textInputClass } from "@/components/ui/classes";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS, Icon } from "@/components/ui/icons";
import { MAX_TEXT_LENGTH } from "@/lib/search";

const PROMISES = [
  "Free to use, with no account needed",
  "Built on the inspection reports HIQA publishes",
  "Independent of HIQA, the HSE and nursing homes",
];

export function HomeHero() {
  return (
    <section aria-labelledby="home-h" className="py-2 md:py-6">
      <div className="grid items-center gap-8 md:grid-cols-[3fr_2fr] md:gap-12">
        <div className="reveal flex min-w-0 flex-col items-start gap-5">
          <p className={eyebrowClass}>Informed decision. Informed consent.</p>
          <h1 id="home-h" className="font-heading text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
            Finding the right care for your loved ones.
          </h1>
          {/* The same mark as under the other pages' headings (welcome-band, globals.css). */}
          <span aria-hidden className="reveal-bar -mt-2 h-1 w-12 origin-left rounded-full bg-accent adult:hidden" />
          {/* "Sums up" is the site's own working-out of each report's judgments, by rules, not AI. */}
          <p className="max-w-xl text-ink-muted md:text-lg">
            When someone you love needs nursing home care, you want to know they will be safe and well looked after.
            HIQA inspects every nursing home for older people in Ireland, but its reports are long and hard to compare.
            ClearCare sums up what each inspection found in a way that is easier to understand, so your family can see
            how a home is doing and talk through the choice together.
          </p>

          {/* Name or Eircode here; the search page works out which. It has address and county too. A
              visible label, not a faded hint in the box: people read one as already filled in
              (CCARE-164). */}
          <form
            action="/search"
            method="GET"
            role="search"
            aria-label="Find a nursing home"
            className="flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-sm adult:rounded-lg adult:shadow-none"
          >
            <label htmlFor="start-search" className="font-semibold">
              Check a nursing home&apos;s record
              <span className="block text-sm font-normal text-ink-muted">Nursing home name or Eircode</span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="start-search"
                name="q"
                type="search"
                maxLength={MAX_TEXT_LENGTH}
                // sm:flex-1, not flex-1: in the phone's column a zero basis would squash its height.
                className={`${textInputClass} w-full sm:flex-1`}
              />
              <button type="submit" className={`${primaryButtonClass} inline-flex items-center justify-center gap-2`}>
                <Icon name="search" />
                Search
              </button>
            </div>
            <p className="text-sm">
              <Link href="/search" className="tap-target">Search by address or county instead →</Link>
            </p>
          </form>

          <Link href="/guides/how-a-family-chooses" className={secondaryLinkClass}>
            Learn how to choose a nursing home <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="reveal flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm [--slide-delay:0.15s] md:p-8 adult:rounded-lg adult:shadow-none">
          <p className="flex items-center gap-3 font-heading text-lg font-semibold">
            <IconCircle path={ICON_PATHS.guides} tint="sage" />
            Practical guidance for you and your family
          </p>
          <ul className="flex flex-col gap-3">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-start gap-3 text-ink-muted">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-1 size-4 shrink-0 text-on-tint-sage"
                >
                  <path d="M5 12.5 10 17.5 19 7" />
                </svg>
                {promise}
              </li>
            ))}
          </ul>
          {/* What the site isn't, said once and plainly, so nobody comes looking for a rating or a bed.
              It sat beside the search before. */}
          <div className="flex flex-col gap-1 border-t border-line-soft pt-4 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="info" className="size-5 text-primary" />
              What this site doesn&apos;t do
            </p>
            <p className="text-ink-muted">
              It doesn&apos;t rate or recommend homes, or show free beds. For beds, ask the home or a hospital social
              worker.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
