import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

// Keep unfinished pages in the navigation as plain text.
const NAV_ITEMS = [
  { label: "Search for Homes", href: "/search" },
  { label: "About the data", href: null },
] as const;

// Keep navigation visible on small screens with a scrollable second row.
export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 px-4 pt-2 md:gap-x-8 md:px-8 lg:py-3">
        <Link href="/" className="font-serif text-xl font-semibold text-ink no-underline hover:text-ink md:text-2xl">
          ClearCare
        </Link>
        <nav aria-label="Main" className="order-last -mx-4 w-full overflow-x-auto px-4 md:-mx-8 md:px-8 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:px-0">
          <ul className="flex gap-4 whitespace-nowrap text-[13px] sm:gap-5 sm:text-sm md:text-[15px]">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <Link href={item.href} className="inline-block py-2.5 text-ink-muted no-underline hover:text-ink">
                    {item.label}
                  </Link>
                ) : (
                  <span className="inline-block py-2.5 text-ink-faint">{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:flex-none">
          <form action="/" role="search" aria-label="Search nursing homes" className="min-w-0 flex-1 sm:flex-none">
            <label htmlFor="site-search" className="sr-only">
              Search nursing homes
            </label>
            <input
              id="site-search"
              name="q"
              type="search"
              placeholder="Name or Eircode"
              className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm sm:w-64"
            />
          </form>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
