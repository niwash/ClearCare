import Link from "next/link";

import { actionLinkClass, fullWidthClass, linkCardClass, secondaryLinkClass, stretchedActionClass } from "@/components/ui/classes";

// What the 404 page says (CCARE-214), without the site's header and footer, so it can be shown in
// two places: app/not-found.tsx, for an address that matches no page, which brings the header and
// footer itself; and app/(site)/not-found.tsx, for notFound() in a page of the (site) group, such as
// a home's page whose centre ID isn't known, where the group's layout already has them. With one
// file for both, a home's 404 showed two headers, two footers and a <main> inside a <main>.
// The tab's title is each not-found file's metadata.

// The pages most people are looking for, so a mistyped address still leads somewhere useful.
const PLACES = [
  { label: "Fair Deal Explained", href: "/guides/fair-deal", hint: "How the HSE helps pay for nursing home care.", action: "Read the guide" },
  { label: "Resources", href: "/resources", hint: "Our guides, and official information from the HSE and HIQA.", action: "See resources" },
  { label: "Contacts", href: "/contacts", hint: "Who to call about nursing home care and Fair Deal.", action: "See contacts" },
];

export function NotFoundContent() {
  return (
    <>
      <section aria-labelledby="not-found-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
        <div className="page-column flex flex-col items-start gap-3 px-4 py-8 md:px-8 md:py-12">
          <p className="text-sm font-semibold text-ink-muted">Error 404</p>
          <h1 id="not-found-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            We can&apos;t find that page
          </h1>
          <p className="max-w-2xl text-ink-muted md:text-lg">
            The link may be out of date, or the address may have a typing mistake. If you were looking
            for a nursing home, try searching for it by name.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link href="/search" className={actionLinkClass}>
              Search for a nursing home <span aria-hidden>→</span>
            </Link>
            <Link href="/" className={secondaryLinkClass}>
              Go to the home page
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="not-found-places-h" className="flex flex-col gap-4">
        <h2 id="not-found-places-h" className="font-heading text-xl font-semibold text-ink md:text-2xl">
          Or try one of these
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {PLACES.map((place) => (
            // The whole card is the link (WCAG 2.5.5): its button's link stretches over it, as on
            // the guide cards.
            <li key={place.href} className={`${linkCardClass} relative flex flex-col items-start gap-1 p-5`}>
              <h3 className="font-semibold text-ink">{place.label}</h3>
              <p className="flex-1 text-sm text-ink-muted">{place.hint}</p>
              <Link href={place.href} className={`${stretchedActionClass} mt-2`}>
                {place.action}
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
