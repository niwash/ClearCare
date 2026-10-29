// components/home/home-hero.tsx
// Under the carousel: who ClearCare is for and what it does, spoken to the person reading, with
// the two first steps, beside a card of why they can rely on it (CCARE-179). The page's h1 is here.
// No photo of its own, as the carousel above has them.
import Link from "next/link";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS, Icon } from "@/components/ui/icons";

const PROMISES = [
  "Free to use, with no account needed",
  "Built on the inspection reports HIQA publishes",
  "Independent of HIQA, the HSE and nursing homes",
];

export function HomeHero() {
  return (
    <section aria-labelledby="home-h" className="grid items-center gap-8 md:grid-cols-[3fr_2fr] md:gap-12">
      <div className="flex flex-col items-start gap-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted adult:normal-case adult:tracking-normal">
          Informed decision. Informed consent.
        </p>
        <h1 id="home-h" className="font-heading text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
          Finding the right care for your loved ones.
        </h1>
        {/* "Sums up" is the site's own working-out of each report's judgments, by rules, not AI. */}
        <p className="max-w-xl text-ink-muted md:text-lg">
          When someone you love needs nursing home care, you want to know they will be safe and well looked after.
          HIQA inspects every nursing home for older people in Ireland, but its reports are long and hard to compare.
          ClearCare sums up what each inspection found, in plain English, so your family can see how a home is doing
          and talk through the choice together.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/search"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-primary px-5 font-semibold text-on-primary no-underline hover:bg-primary-hover hover:text-on-primary"
          >
            <Icon name="search" />
            Find a nursing home <span aria-hidden>→</span>
          </Link>
          <Link
            href="/guides/how-a-family-chooses"
            className="inline-flex h-12 items-center rounded-md border border-line bg-surface px-5 font-semibold text-ink no-underline hover:border-primary hover:text-ink"
          >
            Learn how to choose a nursing home
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8 adult:shadow-none">
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
      </div>
    </section>
  );
}
