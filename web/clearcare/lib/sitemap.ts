// lib/sitemap.ts
// The pages a search engine is told about (CCARE-289): the site's own, each county's (CCARE-303),
// and each home's overview, with its four tabs when a report of it is stored. The tabs are listed
// too (CCARE-301), not left to be reached by their links: the site is new and has few links from
// elsewhere, and the tabs hold the text people search for. The tests load this file as it is
// (tests/sitemap.test.ts), so its imports are named with their extension.
import { COUNTIES } from "./counties.ts";
import { GUIDES } from "./guides.ts";
import { CENTRE_SECTIONS, countyPath, homePath } from "./home-address.ts";

// The most homes the API gives in one answer (page_size in api/openapi.yaml).
const PAGE_SIZE = 50;

// Not /search, which is a question rather than a page, nor /compare and /survey, which are a
// visitor's own.
const SITE_PATHS = ["/", "/national-figures", "/resources", "/resources/glossary", "/resources/regulations", ...GUIDES.map((guide) => `/guides/${guide.slug}`), "/support-services", "/about", "/privacy"];

// The search for a county alone is that county's page, at an address of its own (CCARE-297): the
// page people look for as "nursing homes in Cork".
const COUNTY_PATHS = COUNTIES.map((county) => countyPath(county));

// What the list needs to know of a home: what its address is made of, and whether a report of it is
// stored.
type ListedCentre = { centre_id: string; centre_name: string; county: string; hasReport: boolean };

export function sitemapPaths(centres: ListedCentre[]) {
  const centrePaths = centres.flatMap((home) => [
    homePath(home),
    // Without a stored report the four tabs say only that there is none, the same on every such home.
    ...(home.hasReport ? CENTRE_SECTIONS.map((section) => homePath(home, section)) : []),
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
    const { centres, total }: { centres: { centre_id: string; centre_name: string; county: string; latest_inspection: object | null }[]; total: number } =
      await response.json();
    // latest_inspection is the newest stored report, null when there is none; its date can be null.
    all.push(
      ...centres.map(({ centre_id, centre_name, county, latest_inspection }) => ({
        centre_id,
        centre_name,
        county,
        hasReport: latest_inspection !== null,
      })),
    );
    if (all.length >= total || centres.length === 0) return all;
  }
}
