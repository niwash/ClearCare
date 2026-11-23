// lib/sitemap.ts
// The pages a search engine is told about (CCARE-289): the site's own, and each home's overview,
// whose tabs it reaches by their links. The tests load this file as it is (tests/sitemap.test.ts),
// so its imports are named with their extension.
import { GUIDES } from "./guides.ts";

// The most homes the API gives in one answer (page_size in api/openapi.yaml).
const PAGE_SIZE = 50;

// Not /search, which is a question rather than a page, nor /compare and /survey, which are a
// visitor's own.
const SITE_PATHS = ["/", "/national", "/resources", "/resources/glossary", ...GUIDES.map((guide) => `/guides/${guide.slug}`), "/contacts", "/privacy"];

export function sitemapPaths(centreIds: string[]) {
  return [...SITE_PATHS, ...centreIds.map((id) => `/centres/${id}`)];
}

// The id of every home in the served register, from GET /centres a page at a time.
export async function allCentreIds(apiUrl: string, get: (url: string) => Promise<Response> = fetch) {
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const response = await get(`${apiUrl}/centres?page=${page}&page_size=${PAGE_SIZE}`);
    // No answer is not an empty register: a sitemap without the homes would tell a search engine
    // they are gone.
    if (!response.ok) throw new Error(`GET /centres answered ${response.status}`);
    const { centres, total }: { centres: { centre_id: string }[]; total: number } = await response.json();
    ids.push(...centres.map((centre) => centre.centre_id));
    if (ids.length >= total || centres.length === 0) return ids;
  }
}
