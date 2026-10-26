// components/layout/breadcrumb.tsx
// The trail at the top of every page but the home page: where the page sits in the site, from
// Home down to its parent. The page itself is left out, as its heading is right below; on phones
// only the parent shows, as "‹ Parent", so the trail never wraps, as does a trail of Home alone. Search engines get the full
// trail, the page included, as a BreadcrumbList.
import Link from "next/link";

export type Crumb = { label: string; href: string };

// Labels for the pages in the site header, written the same as there so a crumb reads like the menu.
export const SEARCH_CRUMB: Crumb = { label: "Search for Homes", href: "/search" };
export const RESOURCES_CRUMB: Crumb = { label: "Resources", href: "/resources" };

export function Breadcrumb({ trail, current }: { trail: Crumb[]; current: string }) {
  const crumbs = [{ label: "Home", href: "/" }, ...trail];

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <ol className="flex flex-wrap gap-x-1.5">
          {crumbs.map((crumb, i) => (
            <li key={i} className={i < crumbs.length - 1 ? "max-sm:hidden" : undefined}>
              {/* A trail of Home alone keeps its "‹" on every width, or it reads as a stray link. */}
              <span aria-hidden className={crumbs.length > 1 ? "mr-1.5 sm:hidden" : "mr-1.5"}>
                ‹
              </span>
              {i > 0 && (
                <span aria-hidden className="mr-1.5 max-sm:hidden">
                  ›
                </span>
              )}
              <Link href={crumb.href} className="inline-block py-1 tap-target">
                {crumb.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        // "<" is escaped so a label can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbList(crumbs, current)).replaceAll("<", "\\u003c") }}
      />
    </>
  );
}

// schema.org BreadcrumbList. The URLs are relative, resolved against the page, as the site has no
// fixed address yet; the last item is the page itself, which needs no URL.
function breadcrumbList(crumbs: Crumb[], current: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ...crumbs.map((crumb, i) => ({ "@type": "ListItem", position: i + 1, name: crumb.label, item: crumb.href })),
      { "@type": "ListItem", position: crumbs.length + 1, name: current },
    ],
  };
}
