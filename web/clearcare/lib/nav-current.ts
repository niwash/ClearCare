// lib/nav-current.ts
// Where a navigation link stands to the page being shown (CCARE-296), for the header's links
// (components/layout/nav-item.tsx). Pure, so tests/nav-current.test.ts can check every case.

// The pages each link's section takes in, besides its own and whatever sits under its address
// (/resources/glossary, /compare/...): the guides under Resources, except Fair Deal, which has its
// own link, and a home's pages under Search for Homes, which they're reached from.
const SECTIONS: Record<string, (pathname: string) => boolean> = {
  "/search": (pathname) => pathname.startsWith("/centres/"),
  "/resources": (pathname) => pathname.startsWith("/guides/") && !pathname.startsWith("/guides/fair-deal"),
};

// "page" for the page itself, "true" for a page in its section (the current item of the set, in
// ARIA's words), or nothing. Home is only itself, as every address starts with "/". The query
// string isn't part of the pathname, so a search with filters is still Search for Homes.
export function currentness(href: string | null, pathname: string): "page" | "true" | undefined {
  if (href === null) return undefined;
  if (pathname === href) return "page";
  if (href === "/") return undefined;
  if (pathname.startsWith(`${href}/`) || SECTIONS[href]?.(pathname)) return "true";
  return undefined;
}
