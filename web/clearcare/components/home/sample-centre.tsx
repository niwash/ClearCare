// components/home/sample-centre.tsx
// The start page's example home, under the page's "See what a home's page looks like"
// heading, so its own headings are a level down. Rendered on the server inside <Suspense>, so the
// rest of the page arrives first and this streams in when the home has been picked.
//
// Laid out like a small record (CCARE-232). From desktop width the home and its latest inspection's
// counts are on the left and what wasn't fully compliant on the right, rather than one column whose
// rows were mostly empty; on narrower screens the two stack. Each finding is shown as the record
// shows it on Issues found: the regulation's name first, then how it was judged as the
// record's own chip (finding-bits.tsx). The quotes that page has are left to it, as reading them
// here would take more requests on every visit to the home page. Each column ends in its buttons,
// so no strip under the two is left half empty: the record and another home under the counts, and
// under the findings, on a line that says they open its pages, one to each of the record's tabs, so
// the example shows what a record holds.
import Link from "next/link";
import { JudgementChip } from "@/components/centre/finding-bits";
import { AmenityIcon } from "@/components/centre/amenity-icon";
import { amenityTagClass } from "@/components/centre/centre-amenities";
import { CentrePhoto } from "@/components/centre/centre-photo";
import { JUDGEMENT_LABELS, JudgementIcon } from "@/components/centre/judgement-icon";
import { ShowAnotherHome } from "@/components/home/show-another-home";
import { actionLinkClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";
import { AMENITY_ICON_PATHS } from "@/lib/amenity-icons";
import { CENTRE_SECTION_TITLES } from "@/lib/centre-record";
import { homePath } from "@/lib/home-address";
import { formatDate, type Change } from "@/lib/centres";
import { getSampleCentre } from "@/lib/sample-centre";

// Findings listed before "and N more".
const SHORT_LIST = 5;

// What the home offers, shown with their pictures before "and N more on its page".
const OFFERS_SHOWN = 6;

const COUNT_ORDER = ["not-compliant", "substantially-compliant", "compliant"] as const;

// How a finding compares with the last time the regulation was judged.
const CHANGE_WORDS: Record<Change, string> = {
  worse: "Worse than last time",
  better: "Better than last time",
  same: "Same as last time",
};

// The record's tabs after the overview, in the order the record has them (centres/[id]/layout.tsx).
const TABS = ["issues-found", "how-the-home-responded", "inspections", "what-to-ask"] as const;

// updated: when ClearCare last downloaded HIQA's register (register_snapshot.fetched_at), if known.
export async function SampleCentre({ total, updated }: { total: number | null; updated: string | null }) {
  const sample = await getSampleCentre(total);
  // Nothing could be read: leave the space empty rather than show a broken example.
  if (!sample) return null;

  const { centre, latest, reportCount, firstYear, counts, findings, amenities } = sample;
  const assessed = counts.compliant + counts["substantially-compliant"] + counts["not-compliant"];
  const shown = findings.slice(0, SHORT_LIST);
  // A few of what the home offers that have a picture, the facilities first, then activities and
  // rooms. Care types have no pictures. The rest are on the home's page.
  const offered = amenities ? [...amenities.facilities, ...amenities.activities, ...amenities.room_types] : [];
  const pictured = offered.filter(({ item }) => AMENITY_ICON_PATHS[item]).slice(0, OFFERS_SHOWN);
  const moreOffered = offered.length + (amenities?.care_types.length ?? 0) - pictured.length;

  return (
    <article
      aria-labelledby="sample-h"
      className="reveal overflow-hidden rounded-2xl border border-line bg-surface shadow-sm adult:rounded-lg adult:shadow-none"
    >
      <div className="grid lg:grid-cols-[2fr_3fr]">
        {/* The home and its latest inspection in figures, on a muted panel so the two halves read
            as the home and what was found there. */}
        <div className="flex flex-col gap-5 border-b border-line-soft bg-surface-muted px-4 py-5 md:px-7 md:py-7 lg:border-r lg:border-b-0">
          <div className="flex flex-col gap-1">
            <h3 id="sample-h" className="font-heading text-xl font-semibold md:text-2xl">
              {/* Underlined on hover only in the standard design (CCARE-214); always in Easier to read. */}
              <Link href={homePath(centre)} className="text-ink no-underline tap-target hover:underline adult:underline">
                {centre.centre_name}
              </Link>
            </h3>
            <p className="text-sm text-ink-muted">
              Co. {centre.county} · {reportCount} {reportCount === 1 ? "report" : "reports"} since {firstYear}
            </p>
          </div>

          {/* The home's photo, as on its record (CCARE-258): in user testing (P2_1) the participant
              passed over homes with no photo. The same component, so nothing is asked of Google until
              the reader agrees, and once agreed the record's photos show without asking again. A little
              wider than the record's 4:3, so the column doesn't grow too tall beside the findings. */}
          {/* Keyed by the home, so "Show another home" starts its photo afresh rather than keeping the
              last home's loaded or failed state. */}
          <CentrePhoto
            key={centre.centre_id}
            placeId={centre.place_id ?? null}
            apiKey={process.env.GOOGLE_MAPS_BROWSER_KEY || null}
            className="aspect-[3/2]!"
          />

          <div className="flex flex-col gap-3">
            {/* Two lines, the inspection and then how much it assessed, so neither breaks partway
                through at the column's width (CCARE-258). */}
            <div>
              {/* Plain text, not a link to the report: the record, a button away, has the report's
                  link (CCARE-258). */}
              <p>
                Latest inspection: {latest.type.toLowerCase()}, {formatDate(latest.date)}
              </p>
              <p className="text-ink-muted">
                {assessed} {assessed === 1 ? "regulation" : "regulations"} assessed
              </p>
            </div>
            {/* Each count large, over its judgement's mark and name. */}
            <ul aria-label="Judgements at the latest inspection" className="grid grid-cols-3 gap-2 md:gap-3">
              {COUNT_ORDER.map((judgement) => (
                <li
                  key={judgement}
                  className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-2.5 py-3 sm:px-3 adult:rounded-md"
                >
                  <span className="flex items-center gap-2 font-heading text-2xl font-semibold md:text-3xl">
                    <JudgementIcon judgement={judgement} size={18} />
                    {counts[judgement]}
                  </span>
                  <span className="text-sm leading-snug text-ink-muted">{JUDGEMENT_LABELS[judgement]}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* At the column's foot, level with the record's pages beside them: the record, and
              another home, then how current ClearCare's data is. */}
          <div className="mt-auto flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* The card's call to action, as a button (CCARE-214). */}
              {/* "This home's page", not "full record": the word record threw a participant in user
                  testing (P2_1, CCARE-258). */}
              <Link href={homePath(centre)} className={actionLinkClass}>
                See this home&apos;s page<span className="sr-only">: {centre.centre_name}</span>
                <span aria-hidden>→</span>
              </Link>
              {/* Picks again on the server without reloading the page, so the reader keeps their place. */}
              <ShowAnotherHome currentName={centre.centre_name} />
            </div>
            {/* When ClearCare last downloaded HIQA's register of homes (CCARE-258), as in "What
                ClearCare currently has" above (site-figures.tsx). */}
            {updated && (
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                <Icon name="calendar" className="size-4 shrink-0" />
                <span>
                  ClearCare last updated its data on <time dateTime={updated}>{formatDate(updated)}</time>
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-5 md:px-7 md:py-7">
          <h4 className="font-heading text-lg font-semibold md:text-xl">What wasn&apos;t fully compliant</h4>
          {findings.length === 0 ? (
            <p className="text-ink-muted">All assessed regulations were compliant.</p>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-line-soft">
                {shown.map(({ regulation, judgement, change }) => (
                  <li key={regulation.number} className="flex flex-col gap-1.5 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">{regulation.title}</span>
                      <span className="text-sm text-ink-muted">Regulation {regulation.number}</span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                      <JudgementChip judgement={judgement} />
                      {change && <span className="text-sm text-ink-muted">{CHANGE_WORDS[change]}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {findings.length > shown.length && (
                <p className="text-sm text-ink-muted">and {findings.length - shown.length} more.</p>
              )}
              {/* The rest of what was assessed, so a short list isn't read as the whole inspection. */}
              {counts.compliant > 0 && (
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <JudgementIcon judgement="compliant" />
                  {counts.compliant === 1
                    ? "The other regulation assessed was compliant."
                    : `The other ${counts.compliant} regulations assessed were compliant.`}
                </p>
              )}
            </>
          )}

          {/* A few of what the home offers, with their pictures, as on its record (CCARE-258): in user
              testing (P2_1) the participant liked the amenity icons. Read by an AI tool and still being
              checked, so it says so, as the record and Compare Homes do; change "We're now checking"
              here too when the checking is done (CCARE-192, -193, privacy/page.tsx). Left out when
              nothing with a picture has been read from the home's reports. */}
          {pictured.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
              <h4 className="font-heading text-lg font-semibold md:text-xl">What it offers</h4>
              <ul className="flex flex-wrap gap-2">
                {pictured.map(({ item }) => (
                  <li key={item} className={`${amenityTagClass} flex items-center gap-1.5`}>
                    <AmenityIcon item={item} className="size-4 adult:size-5" />
                    {item}
                  </li>
                ))}
                {moreOffered > 0 && (
                  <li className="flex items-center px-1 text-sm text-ink-muted">and {moreOffered} more on its page</li>
                )}
              </ul>
              <p className="text-sm text-ink-muted">
                Read by an AI tool from its latest inspection report. It may make mistakes and we&apos;re now checking
                these.
              </p>
            </div>
          )}

          {/* Each of the record's tabs by its own name, at the column's foot, each one's arrow the
              site's mark for a link to a page. The same button as "See this home's page", as all the
              card's links into the record look alike; only "Show another home", which stays on this
              page, is outlined. In a grid of equal buttons, two to a row from tablet width, rather
              than a ragged wrapping row, and without the line that introduced them (CCARE-258). The
              grid is only as wide as it needs to be (w-fit), so each button is as wide as the
              longest name, not stretched across the column. */}
          <div className="mt-auto border-t border-line-soft pt-4">
            <ul aria-label={`Pages of this home's record`} className="grid w-fit max-w-full gap-2 sm:grid-cols-2">
              {TABS.map((tab) => (
                <li key={tab} className="flex">
                  <Link href={homePath(centre, tab)} className={`${actionLinkClass} w-full justify-between`}>
                    {CENTRE_SECTION_TITLES[tab]}
                    <span className="sr-only"> for {centre.centre_name}</span>
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}

// Shown while the home is being picked.
export function SampleCentreFallback() {
  return (
    <section
      aria-busy="true"
      aria-label="Randomly picked centre"
      className="flex min-h-64 items-center justify-center rounded-2xl border border-line bg-surface p-6 text-sm text-ink-muted"
    >
      Picking a home at random…
    </section>
  );
}
