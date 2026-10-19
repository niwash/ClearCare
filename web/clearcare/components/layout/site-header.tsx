import Link from "next/link";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { DesignToggle } from "@/components/theme/design-toggle";
import { ThemeToggle } from "@/components/theme/theme-toggle";

// Keep unfinished pages in the navigation as plain text.
const NAV_ITEMS = [
  { label: "Search for Homes", href: "/search" },
  { label: "National figures", href: "/national" },
  { label: "About the data", href: null },
  { label: "Contacts", href: "/contacts" },
  { label: "Resources", href: "/resources" },
] as const;

function NavItem({ item, className }: { item: (typeof NAV_ITEMS)[number]; className: string }) {
  return item.href ? (
    <Link
      href={item.href}
      className={`${className} text-ink-muted no-underline hover:text-ink adult:text-primary adult:underline adult:hover:text-primary-hover`}
    >
      {item.label}
    </Link>
  ) : (
    <span className={`${className} text-ink-faint`}>
      {item.label} (coming soon)
    </span>
  );
}

// On phones and tablets the standard design puts the navigation behind a round "Menu" button
// in the bottom-right corner. The adult-centred design keeps it visible there as a scrollable
// second row, and desktop shows it in the header row in both.
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:gap-x-8 md:px-8 lg:py-3 adult:max-lg:pb-0">
        <Link href="/home" className="font-serif text-xl font-semibold text-ink no-underline hover:text-ink md:text-2xl tap-target">
          ClearCare
        </Link>
        <nav
          aria-label="Main"
          className="order-last -mx-4 hidden w-full overflow-x-auto px-4 md:-mx-8 md:px-8 lg:order-none lg:mx-0 lg:block lg:w-auto lg:flex-1 lg:px-0 adult:block"
        >
          <ul className="flex gap-4 whitespace-nowrap text-[0.8125rem] sm:gap-5 sm:text-sm md:text-[0.9375rem] adult:text-base">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavItem item={item} className="inline-block py-2.5" />
              </li>
            ))}
          </ul>
        </nav>
        {/* flex-auto, not flex-1: sized by its buttons, so on narrow screens it wraps under the
            logo instead of overflowing on top of it. */}
        <div className="flex flex-auto items-center justify-end gap-2 lg:flex-none">
          <DesignToggle />
          <ThemeToggle />
        </div>
        <MobileMenu>
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavItem item={item} className="flex min-h-11 items-center text-base" />
              </li>
            ))}
          </ul>
        </MobileMenu>
      </div>
    </header>
  );
}
