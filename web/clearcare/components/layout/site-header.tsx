import Link from "next/link";
import { Suspense } from "react";

import { AccountControls } from "@/components/auth/account-controls";
import { CompareNavLink } from "@/components/compare/compare-nav-link";
import { CompareStatus } from "@/components/compare/compare-status";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { DesignToggle } from "@/components/theme/design-toggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// An unfinished page has no href and shows as plain text, "(coming soon)". "compare" marks the
// Compare Homes link, which shows how many homes are saved (CCARE-127).
type NavEntry = { label: string; href: string | null; compare?: true };

// The footer lists these too, so a page added here shows in both.
export const NAV_ITEMS: NavEntry[] = [
  { label: "Search for Homes", href: "/search" },
  { label: "Compare Homes", href: "/compare", compare: true },
  // The Fair Deal guide is also under Resources; it has its own link as paying for care is one of
  // the first things families need to understand.
  { label: "Fair Deal", href: "/guides/fair-deal" },
  { label: "Contacts", href: "/contacts" },
  { label: "Resources", href: "/resources" },
  // Last: the figures across every home are background, not a step in choosing one (CCARE-179).
  { label: "National Figures", href: "/national" },
];

function NavItem({ item, className }: { item: NavEntry; className: string }) {
  const linkClass = `${className} text-ink no-underline hover:text-primary adult:text-primary adult:underline adult:hover:text-primary-hover`;
  if (item.compare) return <CompareNavLink label={item.label} className={linkClass} />;
  return item.href ? (
    <Link href={item.href} className={linkClass}>
      {item.label}
    </Link>
  ) : (
    <span className={`${className} text-ink-faint`}>
      {item.label} (coming soon)
    </span>
  );
}

// Two bands, like nhi.ie: the name with the display settings and log in on the right, then the
// navigation in a band of its own, spread across the page on desktop. On phones and tablets the
// standard design puts the navigation behind a round "Menu" button in the bottom-right corner;
// the adult-centred design keeps the band visible there, scrolling sideways if it has to.
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      {/* Says when a home is added to or removed from the shortlist, on every page (CCARE-127). */}
      <CompareStatus />
      {/* brand-band (globals.css) recolours everything inside it for the brand background. */}
      <div className="brand-band brand-band-deep">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:gap-x-8 md:px-8 md:py-5 lg:py-6">
          {/* The name, and under it the motto: what the site is, in one line, on every page (CCARE-179).
              Only the name is the link home. */}
          <div className="flex flex-col">
            <Link href="/" className="w-fit font-heading text-2xl font-semibold text-ink no-underline hover:text-ink md:text-3xl lg:text-4xl tap-target">
              ClearCare
            </Link>
            <p className="text-xs text-ink-muted md:text-sm">Nursing home inspections, made clear</p>
          </div>
          {/* flex-auto, not flex-1: sized by its buttons, so on narrow screens it wraps under the
              logo instead of overflowing on top of it. */}
          <div className="flex flex-auto items-center justify-end gap-2">
            {/* Together, for the welcome tour's step about them. */}
            <div data-tour="display" className="flex items-center gap-2">
              <DesignToggle />
              <ThemeToggle />
            </div>
            {/* Account controls read the session on the server and know the current page, so signing
                in returns the visitor to it. Suspense lets a static page prerender without the query
                string. Left out on phones, where the menu carries them. */}
            <Suspense fallback={null}>
              <AccountControls variant="header" />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Outside the brand band so it keeps the page's colours. It is fixed to the corner, so
          where it sits in the header doesn't matter. */}
      <MobileMenu>
        <ul className="flex flex-col">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <NavItem item={item} className="flex min-h-11 items-center text-base" />
            </li>
          ))}
          <li className="border-t border-line pt-2">
            <Suspense fallback={null}>
              <AccountControls variant="menu" />
            </Suspense>
          </li>
        </ul>
      </MobileMenu>

      <div className="hidden bg-surface-muted lg:block adult:block">
        <nav aria-label="Main" data-tour="nav" className="mx-auto max-w-6xl overflow-x-auto px-4 md:px-8">
          <ul className="flex gap-6 whitespace-nowrap text-sm font-semibold md:text-[0.9375rem] lg:justify-between adult:text-base">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavItem item={item} className="inline-block py-3" />
              </li>
            ))}
            {/* Only seen in the adult-centred design on phones, where the header button is hidden and
                there is no menu. */}
            <li className="sm:hidden">
              <Suspense fallback={null}>
                <AccountControls variant="nav" />
              </Suspense>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
