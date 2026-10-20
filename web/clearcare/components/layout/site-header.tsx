import Link from "next/link";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { DesignToggle } from "@/components/theme/design-toggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { comingSoonClass } from "@/components/ui/classes";

// An unfinished page has no href and shows as plain text, "(coming soon)".
type NavEntry = { label: string; href: string | null };

const NAV_ITEMS: NavEntry[] = [
  { label: "Search for Homes", href: "/search" },
  { label: "National Figures", href: "/national" },
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
          <Link href="/home" className="font-heading text-2xl font-semibold text-ink no-underline hover:text-ink md:text-3xl lg:text-4xl tap-target">
            ClearCare
          </Link>
          {/* flex-auto, not flex-1: sized by its buttons, so on narrow screens it wraps under the
              logo instead of overflowing on top of it. */}
          <div className="flex flex-auto items-center justify-end gap-2">
            <DesignToggle />
            <ThemeToggle />
            {/* Left out on phones, where the row has no room for it until log in exists. */}
            <span
              aria-disabled="true"
              title="Coming soon"
              className={`hidden h-11 items-center px-3 text-sm font-semibold sm:flex ${comingSoonClass}`}
            >
              Log in (coming soon)
            </span>
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
          </ul>
        </nav>
      </div>
    </header>
  );
}
