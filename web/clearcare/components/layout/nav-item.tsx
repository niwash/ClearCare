"use client";

// components/layout/nav-item.tsx
// One link of the site's navigation, in the header's band on desktop and in the phone menu. In the
// browser, so it can tell which page is being shown: that link is marked aria-current="page", which
// screen readers announce and the header styles with a short bar under it (CCARE-258: in user testing
// (P2_1) the navigation wasn't evident, and a participant went back through Home instead).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompareNavLink } from "@/components/compare/compare-nav-link";
import { LastSearchLink } from "@/components/search/last-search";

// An unfinished page has no href and shows as plain text, "(coming soon)". "compare" marks the
// Compare Homes link, which shows how many homes are saved (CCARE-127). "search" marks Search for
// Homes, which goes back to the visitor's last search on this visit (CCARE-214).
export type NavEntry = { label: string; href: string | null; compare?: true; search?: true };

// Only the page a link goes to, exactly: not the pages under it or near it, so a home's page or a
// guide reached from Resources marks nothing. The query string doesn't count, so a search with
// filters is still Search for Homes.
function isCurrent(href: string | null, pathname: string) {
  return href !== null && pathname === href;
}

export function NavItem({ item, className }: { item: NavEntry; className: string }) {
  const pathname = usePathname();
  const current = isCurrent(item.href, pathname);
  const linkClass = `${className} text-ink no-underline hover:text-primary adult:text-primary adult:underline adult:hover:text-primary-hover`;
  if (item.compare) return <CompareNavLink label={item.label} className={linkClass} current={current} />;
  if (item.search)
    return (
      <LastSearchLink className={linkClass} current={current}>
        {item.label}
      </LastSearchLink>
    );
  return item.href ? (
    <Link href={item.href} className={linkClass} aria-current={current ? "page" : undefined}>
      {item.label}
    </Link>
  ) : (
    <span className={`${className} text-ink-faint`}>{item.label} (coming soon)</span>
  );
}
