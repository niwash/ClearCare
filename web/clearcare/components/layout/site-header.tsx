import Link from "next/link";
import { Suspense } from "react";
import { AccountControls } from "@/components/auth/account-controls";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { DesignToggle } from "@/components/theme/design-toggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// An unfinished page has no href and shows as plain text, "(coming soon)".
type NavEntry = { label: string; href: string | null };

const NAV_ITEMS: NavEntry[] = [
  { label: "Search for Homes", href: "/search" },
  { label: "National Figures", href: "/national" },
  // The Fair Deal guide is also under Resources; it has its own link as paying for care is one of
  // the first things families need to understand.
  { label: "Fair Deal", href: "/guides/fair-deal" },
  { label: "Contacts", href: "/contacts" },
  { label: "Resources", href: "/resources" },
];

function NavItem({ item, className }: { item: NavEntry; className: string }) {
  return item.href ? (
    <Link
      href={item.href}
      className={`${className} text-ink no-underline hover:text-primary adult:text-primary adult:underline adult:hover:text-primary-hover`}
    >
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
      {/* brand-band (globals.css) recolours everything inside it for the brand background. */}
      <div className="brand-band brand-band-deep">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:gap-x-8 md:px-8 md:py-5 lg:py-6">
          <Link href="/" className="font-heading text-2xl font-semibold text-ink no-underline hover:text-ink md:text-3xl lg:text-4xl tap-target">
            ClearCare
          </Link>
          {/* flex-auto, not flex-1: sized by its buttons, so on narrow screens it wraps under the
              logo instead of overflowing on top of it. */}
          <div className="flex flex-auto items-center justify-end gap-2">
            <DesignToggle />
            <ThemeToggle />
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
          <Suspense fallback={null}>
            <AccountControls variant="menu" />
          </Suspense>
        </ul>
      </MobileMenu>

      <div className="hidden bg-surface-muted lg:block adult:block">
        <nav aria-label="Main" className="mx-auto max-w-6xl overflow-x-auto px-4 md:px-8">
          <ul className="flex gap-6 whitespace-nowrap text-sm font-semibold md:text-[0.9375rem] lg:justify-between adult:text-base">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavItem item={item} className="inline-block py-3" />
              </li>
            ))}
            {/* Only seen in the adult-centred design on phones, where the header button is hidden and
                there is no menu. */}
            <li className="sm:hidden">
              <NavItem item={{ label: "Log in", href: "/login" }} className="inline-block py-3" />
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
