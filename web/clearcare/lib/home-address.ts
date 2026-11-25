// lib/home-address.ts
// The site's addresses for a county and a home (CCARE-297), in the words people search with:
// /nursing-homes/cork for a county's homes, and /nursing-homes/cork/conna-care-home-4447 for one
// home, with its tabs under it. The home's HIQA centre ID ends its part, so the address still finds
// the home if its name changes; the name and county are read from the register each time, and a page
// reached by an old spelling is sent on to the current one. Pure, so tests/home-address.test.ts can
// check it; the old /centres/<id> addresses are sent here by app/(site)/centres/[...path]/route.ts.
import { COUNTIES } from "./counties.ts";

// A home's pages after its overview, by the end of their address, in the order the tabs show them.
export const CENTRE_SECTIONS = ["issues-found", "how-the-home-responded", "inspections", "what-to-ask"] as const;
export type CentreSection = (typeof CENTRE_SECTIONS)[number];

// The tabs' addresses before CCARE-297, for old links, bookmarks and alert emails.
const OLD_SECTIONS: Record<string, CentreSection> = {
  "look-first": "issues-found",
  "next-steps": "how-the-home-responded",
  inspections: "inspections",
  questions: "what-to-ask",
};

// What a home's address is made from.
export type HomeNaming = { centre_id: string; centre_name: string; county: string };

// Text as a part of an address: lower case, plain letters and digits, words joined by hyphens.
// "St. Joseph’s & Mary’s" is "st-josephs-and-marys"; accents are dropped, so "Áras" is "aras".
export function addressWords(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function countySlug(county: string) {
  return addressWords(county);
}

// The county an address names, as the API spells it, or null for one it doesn't know.
export function countyFromSlug(slug: string) {
  return COUNTIES.find((county) => countySlug(county) === slug) ?? null;
}

// A county's page, and the page of its list from the second on.
export function countyPath(county: string, page = 1) {
  const path = `/nursing-homes/${countySlug(county)}`;
  return page > 1 ? `${path}?page=${page}` : path;
}

// The home's part of its address: its name, then its centre ID.
export function homeSegment(home: Pick<HomeNaming, "centre_id" | "centre_name">) {
  const words = addressWords(home.centre_name);
  return words ? `${words}-${home.centre_id}` : home.centre_id;
}

// The centre ID that part of an address ends with, or null. The ID alone is accepted too.
export function homeIdFrom(segment: string) {
  return /^(?:[a-z0-9-]*-)?(\d{1,8})$/.exec(segment)?.[1] ?? null;
}

// A home's page, or one of its tabs.
export function homePath(home: HomeNaming, section?: CentreSection) {
  const path = `/nursing-homes/${countySlug(home.county)}/${homeSegment(home)}`;
  return section ? `${path}/${section}` : path;
}

// A tab named by its address, old or new, or null for one there isn't.
export function sectionFrom(end: string): CentreSection | null {
  return Object.hasOwn(OLD_SECTIONS, end) ? OLD_SECTIONS[end] : (CENTRE_SECTIONS as readonly string[]).includes(end) ? (end as CentreSection) : null;
}

// The home a path is one of the pages of, by its centre ID and the tab (the overview's is ""), or
// null. For the header's links, the shortlist and the tabs' slide, which only see the path.
export function homeInPath(pathname: string) {
  const match = /^\/nursing-homes\/[a-z-]+\/([^/]+)\/?([^/]*)/.exec(pathname);
  const id = match ? homeIdFrom(match[1]) : null;
  return match && id ? { id, tab: match[2] } : null;
}
