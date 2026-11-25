import Image from "next/image";
import Link from "next/link";

import { AccountControls, AlertsButton } from "@/components/auth/account-controls";
import { CompareStatus } from "@/components/compare/compare-status";
import { ShortlistButton, ShortlistPanel } from "@/components/compare/shortlist-drawer";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NavItem, type NavEntry } from "@/components/layout/nav-item";
import { StickyNav } from "@/components/layout/sticky-nav";
import { DesignToggle } from "@/components/theme/design-toggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// What each entry can be (an unfinished page, Compare Homes, Search for Homes) is in nav-item.tsx.
// The footer lists these too, so a page added here shows in both.
export const NAV_ITEMS: NavEntry[] = [
  // First, as well as the ClearCare name, which not everyone knows leads home (CCARE-186).
  { label: "Home", href: "/" },
  { label: "Search for Homes", href: "/search", search: true },
  { label: "Compare Homes", href: "/compare", compare: true },
  // The Fair Deal guide is also under Resources; it has its own link as paying for care is one of
  // the first things families need to understand.
  { label: "Fair Deal", href: "/guides/fair-deal" },
  // "Support Services", not "Contacts": in user testing (P2_1, CCARE-258) "Contacts" read as a way to
  // contact ClearCare. The page lists other organisations. Its address stays /contacts.
  { label: "Support Services", href: "/support-services" },
  { label: "Resources", href: "/resources" },
  // For the user evaluation (CCARE-147); the home page links to it too.
  { label: "Survey", href: "/survey" },
];

// The ClearCare logo (CCARE-185), the link home, for the header and footer's blue brand band: the
// house from the logo files, and the name as text in the site's heading font, so it matches the
// rest of the site (site-logo-mark, globals.css). className sets the size, by font size, and the
// layout. The house is decorative: the name gives the link its name. unoptimized: an SVG is served
// as it is.
export function SiteLogo({ className }: { className: string }) {
  return (
    <Link href="/" className={`${className} font-heading font-semibold text-ink no-underline hover:text-ink`}>
      <Image src="/logos/clearcare-mark-for-blue.svg" alt="" width={64} height={64} unoptimized className="site-logo-mark" />
      <span>
        Clear<span className="site-logo-care">Care</span>
      </span>
    </Link>
  );
}

// Two bands, like nhi.ie: the name with the display settings and log in on the right, then the
// navigation in a band of its own, spread across the page on desktop. The navigation's band is the
// brand blue a shade lighter than the one above, with white links a little larger than before and a
// short bar under the page being shown, so it reads as the site's menu (CCARE-258: in user testing
// (P2_1) it wasn't evident, on its pale band, that it was there). On phones and tablets the
// standard design puts the navigation behind a round "Menu" button in the bottom-right corner;
// the adult-centred design keeps the band visible there, scrolling sideways if it has to.
//
// The navigation band stays at the top of the window as the page scrolls (CCARE-296), so it is
// after the <header> rather than inside it: a sticky element only sticks within its parent, and
// inside the header it would scroll away with the logo.
export function SiteHeader() {
  return (
    <>
    <header className="border-b border-line bg-surface print:hidden lg:border-b-0 adult:border-b-0">
      {/* Says when a home is added to or removed from the shortlist, on every page (CCARE-127). */}
      <CompareStatus />
      {/* brand-band (globals.css) recolours everything inside it for the brand background. */}
      <div className="brand-band brand-band-deep">
        <div className="page-column flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:gap-x-8 md:px-8 md:py-5 lg:py-6">
          {/* The logo, and under it the motto: what the site is, in one line, on every page (CCARE-179).
              Only the logo is the link home. A grid, so the motto starts under the name, not the
              house: the logo's subgrid shares the columns. */}
          <div className="grid grid-cols-[auto_1fr] items-center">
            <SiteLogo className="col-span-2 grid grid-cols-subgrid items-center text-2xl md:text-3xl lg:text-4xl adult:min-h-11" />
            <p className="col-start-2 text-xs text-ink-muted md:text-sm">Nursing home inspections, made clear</p>
          </div>
          {/* flex-auto, not flex-1: sized by its buttons, so on narrow screens it wraps under the
              logo instead of overflowing on top of it. */}
          <div className="flex flex-auto flex-wrap items-center justify-end gap-2">
            {/* The shortlist from any page (CCARE-258), first, before the display buttons: it opens the
                one panel, ShortlistPanel below. */}
            <ShortlistButton variant="header" />
            {/* Your alerts beside it, in the same outlined shape without the count (CCARE-271). */}
            <AlertsButton />
            {/* Together, for the welcome tour's step about them. A smaller horizontal gap gives
                the adult-centred design's larger labels more room before the buttons wrap. */}
            <div data-tour="display" className="flex flex-wrap items-center justify-end gap-2 adult:gap-x-1">
              <DesignToggle />
              <ThemeToggle />
            </div>
            {/* Read the session in the browser and return the visitor to this page. Left out on
                phones, where the menu carries them. */}
            <AccountControls variant="header" />
          </div>
        </div>
      </div>

      {/* The shortlist's panel, once on every page, opened by every shortlist button (CCARE-258).
          Outside the brand band, like the menu below, so it keeps the page's colours. */}
      <ShortlistPanel />

      {/* Outside the brand band so it keeps the page's colours. It is fixed to the corner, so
          where it sits in the header doesn't matter. */}
      <MobileMenu>
        <ul className="flex flex-col">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              {/* Where the visitor is in bold, with a bar of the accent colour at its left: the page
                  being shown, or the section it sits in, such as Resources for a guide (CCARE-296). */}
              <NavItem
                item={item}
                className="flex min-h-11 items-center text-base [&[aria-current]]:pl-3 [&[aria-current]]:font-bold [&[aria-current]]:shadow-[inset_3px_0_0_var(--accent)]"
              />
            </li>
          ))}
          <li className="border-t border-line pt-2">
            <AccountControls variant="menu" />
          </li>
        </ul>
      </MobileMenu>
    </header>

      {/* brand-band, not brand-band-deep: a shade lighter than the band above, so the two read as
          two bars. A faint line between them. site-nav sets the colour of the current page's bar. */}
      <StickyNav className="site-nav brand-band hidden border-t border-b border-t-white/15 border-b-line shadow-sm lg:block print:hidden adult:block">
        <nav aria-label="Main" data-tour="nav" className="page-column overflow-x-auto px-4 md:px-8">
          <ul className="flex gap-6 whitespace-nowrap text-base font-semibold lg:justify-between">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                {/* On hover or keyboard focus, a tint of the primary colour grows out from the middle of the
                    link and fades in behind it, as well as the colour change, which alone was easy to
                    miss; it presses in a little on a click (CCARE-232). The tint is the link's own
                    ::before, behind its text (isolate, -z-10). The padding and margins cancel out, so
                    the links and the band keep their size and place. The standard design only: the
                    adult-centred one underlines its links already, and keeps still.

                    Where the visitor is, the page being shown or the section it sits in (CCARE-296), keeps
                    that tint behind it and has a short bar under it, just below its name (::after, inside
                    the link's bottom padding), in the colour site-nav sets (globals.css). */}
                <NavItem
                  item={item}
                  className="relative isolate -mx-3 my-1.5 inline-block px-3 py-2.5 after:absolute after:inset-x-3 after:bottom-1 after:h-1 after:rounded-full after:bg-(--nav-current) after:opacity-0 [&[aria-current]]:after:opacity-100 [&[aria-current]]:before:scale-100 [&[aria-current]]:before:opacity-100 adult:after:inset-x-0 adult:after:bottom-0 transition-colors duration-200 before:absolute before:inset-0 before:-z-10 before:scale-75 before:rounded-md before:bg-primary/15 before:opacity-0 before:transition before:duration-200 before:ease-out hover:before:scale-100 hover:before:opacity-100 focus-visible:before:scale-100 focus-visible:before:opacity-100 active:before:scale-95 motion-reduce:before:scale-100 motion-reduce:before:transition-none adult:mx-0 adult:my-0 adult:px-0 adult:py-3 adult:before:hidden"
                />
              </li>
            ))}
            {/* Only seen in the adult-centred design on phones, where the header button is hidden and
                there is no menu. */}
            <li className="sm:hidden">
              <AccountControls variant="nav" />
            </li>
          </ul>
        </nav>
      </StickyNav>
    </>
  );
}
