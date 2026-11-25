import type { Metadata } from "next";
import Link from "next/link";
import { JUDGEMENT_LABELS, JudgementIcon } from "@/components/centre/judgement-icon";
import { Breadcrumb, RESOURCES_CRUMB } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { actionLinkClass, fullWidthClass } from "@/components/ui/classes";
import { IconCircle, type Tint } from "@/components/ui/icon-circle";
import { Icon, ICON_PATHS } from "@/components/ui/icons";
import { Chevron, ShowHide } from "@/components/ui/chevron";
import { Cite, References } from "@/components/ui/references";
import type { Judgement } from "@/lib/centres";
import { judgementMeaning } from "@/lib/glossary";
import { pageReferences } from "@/lib/references";
import { REGULATION_GUIDE, REGULATION_THEMES, type RegulationTheme } from "@/lib/regulation-guide";
import {
  allRegulations,
  regulationAnchor,
  type RegulationListing,
  type RegulationQuote,
} from "@/lib/regulations";

export const metadata: Metadata = {
  title: "Regulations Explained · ClearCare",
  description: "What each regulation a nursing home is inspected against means, in plain English and in HIQA's own words.",
};

// The framework every quote is from, the standards a "standard" quote is from, and the statutory
// instrument that sets the regulations and their numbers down in law (lib/references.ts).
const REFS = pageReferences(["hiqaFramework", "hiqaStandards", "careRegulations"]);
const JUDGEMENTS: Judgement[] = ["compliant", "substantially-compliant", "not-compliant"];

// Each theme's accent, written out in full so Tailwind finds them: the tint of its number badges. The
// adult-centred design turns every tint to its one band colour (globals.css).
const ACCENTS: Record<Tint, { badge: string }> = {
  sage: { badge: "bg-tint-sage text-on-tint-sage" },
  rose: { badge: "bg-tint-rose text-on-tint-rose" },
  gold: { badge: "bg-tint-gold text-on-tint-gold" },
  blue: { badge: "bg-tint-blue text-on-tint-blue" },
  band: { badge: "bg-band text-primary" },
};

// What each regulation means for a family (CCARE-261), grouped by theme: a plain-English line first,
// a question to ask on a visit where there is one, and HIQA's own words under them, quoted and
// cited, with the full references at the foot of the page. The plain words and themes are
// ClearCare's (lib/regulation-guide.ts); the quotes are HIQA's (lib/regulations.ts), the same the
// hover on a regulation's title in a home's inspection history shows. Each regulation keeps its own
// anchor (/resources/regulations#regulation-17), so other pages can link to one.
export default function RegulationsPage() {
  const byNumber = new Map(allRegulations().map((regulation) => [regulation.number, regulation]));
  const themes = REGULATION_THEMES.map((theme) => ({
    theme,
    regulations: theme.regulations.map((number) => byNumber.get(number)).filter((r): r is RegulationListing => !!r),
  }));
  // Not inspected, so not in a theme: at the end, folded away.
  const themed = new Set(REGULATION_THEMES.flatMap((theme) => theme.regulations));
  const others = [...byNumber.values()].filter((regulation) => !themed.has(regulation.number));

  return (
    <>
      <RegulationsHero />

      <WhatAreRegulations />

      {/* The contents beside the regulations from desktop width, kept in view as the page scrolls;
          above them, folded, on smaller screens. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-12">
          <details className="group rounded-2xl bg-surface shadow-sm lg:hidden adult:border adult:border-line adult:shadow-none">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              Jump to a regulation
              <ShowHide />
            </summary>
            <div className="px-5 pb-5">
              <Contents themes={themes} others={others} />
            </div>
          </details>

          {themes.map(({ theme, regulations }) => (
            <ThemeSection key={theme.id} theme={theme} regulations={regulations} />
          ))}

          {others.length > 0 && <OtherRegulations regulations={others} />}
        </div>

        <nav
          aria-labelledby="contents-h"
          className="sticky top-6 hidden max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-surface p-5 shadow-sm lg:block adult:border adult:border-line adult:shadow-none"
        >
          <h2 id="contents-h" className="mb-3 font-heading text-lg font-semibold">
            Jump to a regulation
          </h2>
          <Contents themes={themes} others={others} />
        </nav>
      </div>

      <References
        references={REFS.list}
        note={
          <>
            HIQA&apos;s words are quoted as HIQA published them; the plain-English lines and questions are
            ClearCare&apos;s. These organisations do not endorse ClearCare.
          </>
        }
      />

      <NextSteps />

      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}

function RegulationsHero() {
  return (
    <section aria-labelledby="regulations-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
      <div className="page-column flex flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb trail={[RESOURCES_CRUMB]} current="Regulations Explained" />
        <h1
          id="regulations-h"
          className="scroll-mt-6 font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl"
        >
          Regulations Explained
        </h1>
      </div>
    </section>
  );
}

// What regulations are, in the "i" note the guides use: a light amber box (CCARE-258), which in user
// testing (P2_1) the participant noticed and liked. The three judgements as a key, each with its
// mark, as a home's inspection history draws them, and the glossary's plain meaning.
function WhatAreRegulations() {
  return (
    <aside
      aria-labelledby="what-h"
      className="flex max-w-3xl items-start gap-3 rounded-2xl border border-on-tint-gold/30 bg-tint-gold p-5 text-ink md:p-6 adult:rounded-lg"
    >
      <Icon name="info" className="mt-1 size-5 shrink-0 text-on-tint-gold" />
      <div className="flex flex-col gap-3">
        <h2 id="what-h" className="font-heading text-lg font-semibold md:text-xl">
          What are regulations?
        </h2>
        <p className="text-lg leading-relaxed">
          Every nursing home in Ireland is inspected and is expected to meet the standards of good care. Inspectors
          check the regulations below, most of them tied to HIQA&apos;s National Standards, and judge each one in one of
          three ways:
        </p>
        <ul aria-label="The three judgements" className="flex flex-col gap-2.5">
          {JUDGEMENTS.map((judgement) => (
            <li key={judgement} className="flex items-start gap-2.5">
              <span className="mt-1.5">
                <JudgementIcon judgement={judgement} size={16} />
              </span>
              <span>
                <span className="font-semibold">{JUDGEMENT_LABELS[judgement]}:</span>{" "}
                {judgementMeaning(judgement)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// The regulations by theme, each one a link to its card.
function Contents({
  themes,
  others,
}: {
  themes: { theme: RegulationTheme; regulations: RegulationListing[] }[];
  others: RegulationListing[];
}) {
  const group = (id: string, title: string, regulations: RegulationListing[]) => (
    <li key={id} className="flex flex-col gap-1">
      <a href={`#${id}`} className="text-sm font-semibold text-ink">
        {title}
      </a>
      <ol className="flex flex-col">
        {regulations.map(({ number, title: name }) => (
          <li key={number}>
            <a
              href={`#${regulationAnchor(number)}`}
              className="flex min-h-9 items-baseline gap-2 py-1 text-sm text-ink-muted hover:text-ink"
            >
              <span className="w-8 shrink-0 text-right font-semibold tabular-nums">
                <span aria-hidden="true">#</span>
                {number}
              </span>
              <span>{name}</span>
            </a>
          </li>
        ))}
      </ol>
    </li>
  );

  return (
    <ul className="flex flex-col gap-4">
      {themes.map(({ theme, regulations }) => group(theme.id, theme.title, regulations))}
      {others.length > 0 && group("other-regulations", "Other regulations", others)}
    </ul>
  );
}

// One theme: its icon, heading with the site's accent mark under it, a line on what it covers, then
// its regulations' cards.
function ThemeSection({ theme, regulations }: { theme: RegulationTheme; regulations: RegulationListing[] }) {
  const accent = ACCENTS[theme.tint];

  return (
    <section id={theme.id} aria-labelledby={`${theme.id}-h`} className="flex scroll-mt-6 flex-col gap-5">
      <div className="flex items-start gap-4">
        <IconCircle path={ICON_PATHS[theme.icon]} size="large" tint={theme.tint} />
        <div className="flex flex-col gap-2">
          <h2 id={`${theme.id}-h`} className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {theme.title}
          </h2>
          <span aria-hidden className="h-1 w-12 rounded-full bg-accent adult:hidden" />
          <p className="text-lg text-ink-muted">{theme.intro}</p>
        </div>
      </div>

      <ol aria-label={theme.title} className="flex flex-col gap-5">
        {regulations.map((regulation) => (
          <RegulationCard key={regulation.number} regulation={regulation} accent={accent} />
        ))}
      </ol>

      {/* Back to the top on phones, where the contents aren't beside the cards. */}
      <a href="#regulations-h" className="w-fit text-sm font-semibold text-ink-muted lg:hidden">
        Back to top <span aria-hidden>↑</span>
      </a>
    </section>
  );
}

// A regulation's card: its number in a badge, its title, what it means in plain English, a question
// to ask on a visit, and HIQA's words, smaller, under them.
function RegulationCard({ regulation, accent }: { regulation: RegulationListing; accent: { badge: string } }) {
  const guide = REGULATION_GUIDE[regulation.number];

  return (
    <li
      id={regulationAnchor(regulation.number)}
      className="flex scroll-mt-6 flex-col gap-4 rounded-2xl bg-surface p-6 shadow-sm adult:rounded-lg adult:border adult:border-line adult:shadow-none"
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full font-semibold tabular-nums ${accent.badge}`}
        >
          <span className="sr-only">Regulation </span>
          <span aria-hidden="true">#</span>
          {regulation.number}
        </span>
        <h3 className="font-heading text-xl font-semibold">{regulation.title}</h3>
      </div>

      {guide && <p className="text-lg leading-relaxed">{guide.plain}</p>}

      {guide?.ask && (
        <p className="flex items-start gap-2.5 rounded-xl bg-surface-muted px-4 py-3 adult:rounded-md adult:border adult:border-line-soft">
          <Icon name="talk" className="mt-1 size-4 shrink-0 text-ink-muted" />
          <span>
            <span className="font-semibold">Ask on your visit:</span> {guide.ask}
          </span>
        </p>
      )}

      {"quote" in regulation ? (
        // HIQA's own words folded under the plain line, a press away, so the card reads in one sentence
        // and the quote and its source are there for whoever wants them.
        <details className="group">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">See HIQA&apos;s words</span>
            <span className="hidden group-open:inline">Hide HIQA&apos;s words</span>
            <Chevron className="size-4 group-open:rotate-90" />
          </summary>
          <figure className="mt-1 flex flex-col gap-1.5 border-l-2 border-line pl-3 text-ink-muted">
            <blockquote className="leading-relaxed">&ldquo;{regulation.quote.text}&rdquo;</blockquote>
            <figcaption className="text-sm">
              <Attribution quote={regulation.quote} />
            </figcaption>
          </figure>
        </details>
      ) : (
        // Not HIQA's words, so not a quote: ClearCare's summary, and the card says so.
        <div className="flex flex-col gap-1.5">
          <p className="text-lg leading-relaxed">{regulation.summary}</p>
          <p className="text-sm text-ink-muted">
            Our summary of the regulation (<Cite reference={REFS.careRegulations} />). It isn&apos;t
            inspected, so HIQA doesn&apos;t describe it.
          </p>
        </div>
      )}
    </li>
  );
}

// The regulations that aren't inspected, folded at the end: they name the regulations and define
// their words, so there's nothing in them a family needs to look for.
function OtherRegulations({ regulations }: { regulations: RegulationListing[] }) {
  return (
    <details id="other-regulations" className="group scroll-mt-6 rounded-2xl bg-surface shadow-sm adult:border adult:border-line adult:shadow-none">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col">
          <span className="font-heading text-xl font-semibold">Other regulations</span>
          <span className="text-ink-muted">The ones that name the regulations and define their words.</span>
        </span>
        <ShowHide />
      </summary>
      <ol aria-label="Other regulations" className="flex flex-col gap-5 px-6 pb-6">
        {regulations.map((regulation) => (
          <RegulationCard key={regulation.number} regulation={regulation} accent={ACCENTS.band} />
        ))}
      </ol>
    </details>
  );
}

// Where a quote is from: a National Standard, as the framework links it to the regulation, or one of
// the framework's own lines of enquiry.
function Attribution({ quote }: { quote: RegulationQuote }) {
  if (quote.kind === "standard") {
    return (
      <>
        National Standard {quote.standard} (<Cite reference={REFS.hiqaStandards} />), which HIQA assesses
        this regulation against (<Cite reference={REFS.hiqaFramework} />)
      </>
    );
  }
  return (
    <>
      A question HIQA&apos;s inspectors ask about this regulation (<Cite reference={REFS.hiqaFramework} />)
    </>
  );
}

// Where to go next, before the support services band: the search, now the regulations make sense.
function NextSteps() {
  return (
    <section
      aria-labelledby="next-h"
      className="flex flex-col items-start gap-4 rounded-2xl bg-tint-sage p-6 md:flex-row md:items-center md:justify-between md:p-8 adult:rounded-lg"
    >
      <div className="flex flex-col gap-1">
        <h2 id="next-h" className="font-heading text-xl font-semibold md:text-2xl">
          Ready to look at homes?
        </h2>
        <p className="text-ink-muted">See how each home did on these regulations at its inspections.</p>
      </div>
      <Link href="/search" className={`${actionLinkClass} shrink-0`}>
        Search for homes <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
