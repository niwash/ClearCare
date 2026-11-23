"use client";

// components/layout/nav-item.tsx
// One link of the site's navigation, in the header's band on desktop and in the phone menu. In the
// browser, so it can tell where the visitor is: the link for the page being shown is marked
// aria-current="page", and the link for the section a page sits in is marked aria-current="true"
// (CCARE-296), so a guide reached from Resources still shows Resources. Screen readers announce
// both, and the header styles both with a short bar under the link (CCARE-258: in user testing
// (P2_1) the navigation wasn't evident, and a participant went back through Home instead).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompareNavLink } from "@/components/compare/compare-nav-link";
import { LastSearchLink } from "@/components/search/last-search";
import { currentness } from "@/lib/nav-current";

// An unfinished page has no href and shows as plain text, "(coming soon)". "compare" marks the
// Compare Homes link, which shows how many homes are saved (CCARE-127). "search" marks Search for
// Homes, which goes back to the visitor's last search on this visit (CCARE-214).
export type NavEntry = { label: string; href: string | null; compare?: true; search?: true };

export function NavItem({ item, className }: { item: NavEntry; className: string }) {
  const pathname = usePathname();
  const current = currentness(item.href, pathname);
  const linkClass = `${className} text-ink no-underline hover:text-primary adult:text-primary adult:underline adult:hover:text-primary-hover`;
  if (item.compare) return <CompareNavLink label={item.label} className={linkClass} current={current} />;
  if (item.search)
    return (
      <LastSearchLink className={linkClass} current={current}>
        {item.label}
      </LastSearchLink>
    );
  return item.href ? (
    <Link href={item.href} className={linkClass} aria-current={current}>
      {item.label}
    </Link>
  ) : (
    <span className={`${className} text-ink-faint`}>{item.label} (coming soon)</span>
  );
}
