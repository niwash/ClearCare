import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FairDealCalculator } from "@/components/guides/fair-deal-calculator";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { fullWidthClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";
import { calculatorStructuredData } from "@/lib/calculator-structured-data";

// In the words people search with, "Fair Deal calculator" first, with "nursing home" and Ireland, which
// a search for the scheme often adds (CCARE-237). The description is what a search result shows.
const TITLE = "Fair Deal Calculator for Nursing Home Costs · ClearCare";
const DESCRIPTION =
  "Free Fair Deal calculator: estimate your weekly nursing home contribution in Ireland from income, savings and property, using the HSE's published rates.";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION };

// CCARE-237. Like the calculators on other Irish sites, it applies the HSE's published arithmetic
// (lib/fair-deal.ts). We know how the HSE calculates a contribution, not how it assesses the
// figures that go into it, so the page says plainly which is which, before the calculator and in
// full after it.
const HSE_FINANCIAL = "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/financial-assessment/";
const HSE_NHSS = "https://www.hse.ie/nhss/";

export default function FairDealCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // "<" is escaped so text can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(calculatorStructuredData(DESCRIPTION)).replaceAll("<", "\\u003c") }}
      />

      <section aria-labelledby="calculator-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
        <div className="page-column flex flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
          <Breadcrumb trail={[{ label: "Fair Deal", href: "/guides/fair-deal" }]} current="Fair Deal Calculator" />
          <h1 id="calculator-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Fair Deal Calculator
          </h1>
        </div>
      </section>

      {/* A light amber box, as the notes in the guides (CCARE-233), with an exclamation mark rather
          than their "i": the figure below is easy to take for the real one. The one place the page says
          so before the figures, so the estimate panel doesn't repeat it. */}
      <aside className="flex max-w-4xl items-start gap-3 rounded-lg border border-on-tint-gold/30 bg-tint-gold px-5 py-4 md:text-lg">
        <Icon name="caution" className="mt-0.5 size-5 shrink-0 text-on-tint-gold md:mt-1" />
        <p>
          <span className="font-semibold">This is an estimate, not the HSE&apos;s figure.</span> We know how the HSE{" "}
          <em>calculates</em> a contribution, but we don&apos;t know how it will <em>assess</em> your figures: which
          income and deductions it accepts, or what it values property at. See{" "}
          <a href="#about-this-estimate">About this estimate</a> below.
        </p>
      </aside>

      <FairDealCalculator />

      <section aria-labelledby="about-this-estimate" className="flex max-w-4xl flex-col gap-4 leading-relaxed">
        <h2 id="about-this-estimate" className="scroll-mt-6 font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          About this estimate
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="What it does">
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Takes 80% of income for a single person, or 40% of a couple&apos;s combined income, after any deductions
                you enter.
              </li>
              <li>
                Takes 7.5% a year of savings and property above €36,000 for a single person, or 3.75% above €72,000 for a
                couple. The €36,000 or €72,000 comes off savings first, then property.
              </li>
              <li>Counts the home for the first 3 years in care only. Other property has no 3-year limit.</li>
              <li>Turns the yearly amount into a weekly one over 52 weeks, as the HSE&apos;s examples do.</li>
              <li>Never shows more than the nursing home&apos;s charge, when you enter it.</li>
            </ul>
            <p className="text-sm text-ink-muted">
              These rates are from the HSE&apos;s <Source href={HSE_FINANCIAL}>Financial assessment</Source> page, checked
              on 14 November 2026.
            </p>
          </Panel>

          <Panel title="What it can't tell you">
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>How the HSE will assess your figures.</strong> It decides what counts as income, which deductions
                it allows, and what your home and other property are worth. Its figures can differ from yours.
              </li>
              <li>
                Gifts or transfers made in the last 5 years, which the HSE can count as if they were still owned.
              </li>
              <li>Farms and businesses, which have their own rules, including a possible 3-year limit.</li>
              <li>
                Rental income from the home while in care, which you can apply to have made exempt. Leave it out of
                income here if you plan to apply.
              </li>
              <li>
                Any amount of income the HSE leaves for personal spending, savings being spent over time, or changes to
                the rules after the date above.
              </li>
            </ul>
          </Panel>
        </div>

        <p>
          The estimate is not financial or legal advice, and it is not a decision from the HSE. ClearCare is not part of
          the HSE. Before making decisions, check <Source href={HSE_NHSS}>hse.ie/nhss</Source>, call Citizens Information
          on{" "}
          <a href="tel:0818074000" className="tap-target">
            0818 07 4000
          </a>
          , or talk to a solicitor.
        </p>
        <p>
          <Link href="/guides/fair-deal#how-much-will-you-pay">Read how the contribution is worked out</Link>, with worked
          examples, in Fair Deal Explained.
        </p>
      </section>

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
      <h3 className="font-semibold md:text-lg">{title}</h3>
      {children}
    </div>
  );
}

// A link to a source, opening on its own site.
function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
