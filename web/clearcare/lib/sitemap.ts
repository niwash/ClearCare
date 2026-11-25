// lib/sitemap.ts
// The pages a search engine is told about (CCARE-289): the site's own, each county's (CCARE-303),
// and each home's overview, with its four tabs when a report of it is stored. The tabs are listed
// too (CCARE-301), not left to be reached by their links: the site is new and has few links from
// elsewhere, and the tabs hold the text people search for. The tests load this file as it is
// (tests/sitemap.test.ts), so its imports are named with their extension.
import type { CentreSection } from "./centre-record.ts";
import { COUNTIES } from "./counties.ts";
import { GUIDES } from "./guides.ts";

// The most homes the API gives in one answer (page_size in api/openapi.yaml).
const PAGE_SIZE = 50;

// Not /search, which is a question rather than a page, nor /compare and /survey, which are a
// visitor's own.
const SITE_PATHS = ["/", "/national", "/resources", "/resources/glossary", "/resources/regulations", ...GUIDES.map((guide) => `/guides/${guide.slug}`), "/contacts", "/privacy"];

// The search for a county alone is that county's page, with this as the address it gives as its
// own (countyAloneHref, lib/page-search.ts): the page people look for as "nursing homes in Cork".
const COUNTY_PATHS = COUNTIES.map((county) => `/search?county=${county}`);

// A home's tabs after its overview, in the order the record shows them.
const CENTRE_SECTIONS: CentreSection[] = ["look-first", "next-steps", "inspections", "questions"];

// What the list needs to know of a home: its id, and whether a report of it is stored.
type ListedCentre = { id: string; hasReport: boolean };

export function sitemapPaths(centres: ListedCentre[]) {
  const centrePaths = centres.flatMap(({ id, hasReport }) => [
    `/centres/${id}`,
    // Without a stored report the four tabs say only that there is none, the same on every such home.
    ...(hasReport ? CENTRE_SECTIONS.map((section) => `/centres/${id}/${section}`) : []),
  ]);
  return [...SITE_PATHS, ...COUNTY_PATHS, ...centrePaths];
}

// Every home in the served register, from GET /centres a page at a time.
export async function allCentres(apiUrl: string, get: (url: string) => Promise<Response> = fetch) {
  const all: ListedCentre[] = [];
  for (let page = 1; ; page++) {
    const response = await get(`${apiUrl}/centres?page=${page}&page_size=${PAGE_SIZE}`);
    // No answer is not an empty register: a sitemap without the homes would tell a search engine
    // they are gone.
    if (!response.ok) throw new Error(`GET /centres answered ${response.status}`);
    const { centres, total }: { centres: { centre_id: string; latest_inspection: object | null }[]; total: number } = await response.json();
    // latest_inspection is the newest stored report, null when there is none; its date can be null.
    all.push(...centres.map((centre) => ({ id: centre.centre_id, hasReport: centre.latest_inspection !== null })));
    if (all.length >= total || centres.length === 0) return all;
  }
}
