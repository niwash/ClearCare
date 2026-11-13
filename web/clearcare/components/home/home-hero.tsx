// components/home/home-hero.tsx
// Under the carousel: who ClearCare is for and what it does, spoken to the person reading, with the
// search right there as the first thing they can do, beside a card of why they can rely on it
// (CCARE-179). The page's h1 is here. No photo of its own, as the carousel above has them. The
// search was at the foot of the page before; a family arriving with a home in mind shouldn't have
// to scroll past everything else to reach it. Both columns slide up as the page opens, the card a
// moment after the words (CCARE-186).
//
// On a warm band of its own, the full width of the window, meeting the carousel (home-welcome,
// globals.css), so the page opens on colour rather than on bare page. The card is as tall as the
// words beside it and filled from top to bottom: the promises, what the site doesn't do, and where
// to start for someone with no home in mind yet, so neither column leaves a gap beside the other.
import Link from "next/link";
import { eyebrowClass, fullWidthClass, primaryButtonClass, secondaryLinkClass, textInputClass } from "@/components/ui/classes";
import { IconCircle, type Tint } from "@/components/ui/icon-circle";
import { ICON_PATHS, Icon } from "@/components/ui/icons";
import { MAX_TEXT_LENGTH } from "@/lib/search";

// Each with a tick in a soft colour of its own.
const PROMISES: { text: string; tint: Tint }[] = [
  { text: "Free to use, with no account needed", tint: "sage" },
  { text: "Built on the inspection reports HIQA publishes", tint: "blue" },
  { text: "Independent of HIQA, the HSE and nursing homes", tint: "gold" },
];

const TICK = "M5 12.5 10 17.5 19 7";

export function HomeHero() {
  return (
    // The negative top margin cancels the page's gap, so the band meets the carousel.
    <section aria-labelledby="home-h" className={`${fullWidthClass} home-welcome -mt-6 md:-mt-8`}>
      <div className="page-column grid gap-8 px-4 py-10 md:px-8 md:py-14 lg:grid-cols-[3fr_2fr] lg:gap-14">
        <div className="reveal flex min-w-0 flex-col items-start justify-center gap-5">
          <p className={eyebrowClass}>Informed decision. Informed consent.</p>
          <h1 id="home-h" className="font-heading text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
            Finding the right care for your loved ones.
          </h1>
          {/* The same mark as under the other pages' headings (welcome-band, globals.css). */}
          <span aria-hidden className="reveal-bar -mt-2 h-1 w-12 origin-left rounded-full bg-accent adult:hidden" />
          {/* "Sums up" is the site's own working-out of each report's judgments, by rules, not AI.
              Beside the card it and the search fill their column, so no gap opens between the two. */}
          <p className="max-w-xl text-ink-muted md:text-lg lg:max-w-none">
            When someone you love needs nursing home care, you want to know they will be safe and well looked after.
            HIQA inspects every nursing home for older people in Ireland, but its reports are long and hard to compare.
            ClearCare sums up what each inspection found in a way that is easier to understand, so your family can see
            how a home is doing and talk through the choice together.
          </p>

          {/* A name, a county or an Eircode here. The search page takes a county as the County filter
              and an Eircode as the place, and settles anything else in the browser by its own box's
              rule, which can ask Google where a town is (settleBox, lib/search-box.ts). A visible
              label, not a faded hint in the box: people read one as already filled in (CCARE-164). */}
          <form
            action="/search"
            method="GET"
            role="search"
            aria-label="Find a nursing home"
            className="flex w-full max-w-xl flex-col gap-2 rounded-2xl lg:max-w-none border border-line bg-surface p-4 shadow-md md:p-5 adult:rounded-lg adult:shadow-none"
          >
            <label htmlFor="start-search" className="font-semibold">
              Check a nursing home&apos;s record
              <span className="block text-sm font-normal text-ink-muted">Nursing home name, town, county or Eircode</span>
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
              {/* Without scripts nothing can ask Google, so the search page is told, and takes
                  anything that isn't a county or an Eircode as a name. */}
              <noscript>
                <input type="hidden" name="scripts" value="off" />
              </noscript>
              <button type="submit" className={`${primaryButtonClass} inline-flex items-center justify-center gap-2`}>
                <Icon name="search" />
                Search
              </button>
            </div>
            <p className="text-sm">
              <Link href="/search" className="tap-target">Search with filters and the map →</Link>
            </p>
          </form>
        </div>

        <div className="reveal flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 shadow-md [--slide-delay:0.08s] md:p-8 adult:rounded-lg adult:shadow-none">
          <p className="flex items-center gap-3 font-heading text-xl font-semibold">
            <IconCircle path={ICON_PATHS.guides} size="large" tint="sage" />
            Practical guidance for you and your family
          </p>
          {/* Takes whatever height is left, its lines spread evenly, so the card has no empty patch. */}
          <ul className="flex flex-1 flex-col justify-evenly gap-4">
            {PROMISES.map(({ text, tint }) => (
              <li key={text} className="flex items-center gap-3 text-ink md:text-lg">
                <IconCircle path={TICK} tint={tint} />
                {text}
              </li>
            ))}
          </ul>
          {/* What the site isn't, said once and plainly, so nobody comes looking for a rating or a bed.
              It sat beside the search before. */}
          <div className="flex flex-col gap-1 rounded-xl bg-surface-muted px-4 py-3 text-sm adult:rounded-md adult:border adult:border-line">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="info" className="size-5 text-primary" />
              What this site doesn&apos;t do
            </p>
            <p className="text-ink-muted">
              It doesn&apos;t rate or recommend homes, or show free beds. For beds, ask the home or a hospital social
              worker.
            </p>
          </div>
          {/* For someone with no home in mind yet: the guide to choosing one. Under the search before,
              where it left the card beside it short. */}
          <div className="flex flex-col items-start gap-3 border-t border-line-soft pt-5">
            <p className="font-semibold">Not sure where to start?</p>
            <Link href="/guides/how-a-family-chooses" className={secondaryLinkClass}>
              Learn how to choose a nursing home <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
