// lib/breadcrumb-list.ts
// The breadcrumb as a search engine reads it: a schema.org BreadcrumbList, written into the page by
// components/layout/breadcrumb.tsx. The tests load this file as it is
// (tests/breadcrumb-list.test.ts), so its import is named with its extension.
import { SITE_URL } from "./site-url.ts";

export type Crumb = { label: string; href: string };

// Each URL is a full address on the live site (CCARE-301): Search Console reports a relative one
// as "Invalid URL in field 'id'". The last item is the page itself, which needs no URL.
export function breadcrumbList(crumbs: Crumb[], current: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ...crumbs.map((crumb, i) => ({ "@type": "ListItem", position: i + 1, name: crumb.label, item: `${SITE_URL}${crumb.href}` })),
      { "@type": "ListItem", position: crumbs.length + 1, name: current },
    ],
  };
}
