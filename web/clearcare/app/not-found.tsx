import Link from "next/link";

import { DocumentTitle } from "@/components/layout/document-title";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { actionLinkClass, fullWidthClass, linkCardClass, secondaryLinkClass, stretchedActionClass } from "@/components/ui/classes";

// The 404 page (CCARE-214), for an address that matches no page and for a home's page whose centre
// ID isn't known (notFound() in centres/[id]). In the root app folder, so it catches both: it
// replaces everything under the root layout, so it brings the site's header and footer itself, as
// the (site) layout does. A not-found file can't export metadata, so DocumentTitle sets the tab's
// title; Next.js adds the noindex tag for a 404 on its own.

// The pages most people are looking for, so a mistyped address still leads somewhere useful.
const PLACES = [
  { label: "Fair Deal Explained", href: "/guides/fair-deal", hint: "How the HSE helps pay for nursing home care.", action: "Read the guide" },
  { label: "Resources", href: "/resources", hint: "Our guides, and official information from the HSE and HIQA.", action: "See resources" },
  { label: "Contacts", href: "/contacts", hint: "Who to call about nursing home care and Fair Deal.", action: "See contacts" },
];

export default function NotFound() {
  return (
    <>
      <DocumentTitle title="Page not found · ClearCare" />
      <SiteHeader />
      <main className="page-column flex w-full flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-10">
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
      </main>
      <SiteFooter />
    </>
  );
}
