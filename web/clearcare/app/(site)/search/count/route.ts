// app/(site)/search/count/route.ts
// How many homes a search would find, and each filter option's count, for the filters sheet on
// phones (SearchFilters): its choices only apply on "Show n nursing homes", so the page's own counts
// are for the search before them. The same parameters as the search page.
import { apiFilterParams } from "@/lib/search-filters";
import { hasSearch, readSearch, searchCentres } from "@/lib/search";

export async function GET(request: Request) {
  const search = readSearch(Object.fromEntries(new URL(request.url).searchParams));
  const result = await searchCentres({ ...search.query, page: "1", page_size: "1" }, apiFilterParams(search.selection));
  if (!result.ok) return Response.json({ detail: result.detail }, { status: result.status || 502 });
  // Nothing is listed until something is searched for (hasSearch, as on the search page), so with
  // nothing chosen there's no total and the button says "Search". The counts are still every home's.
  return Response.json({ total: hasSearch(search) ? result.data.total : null, facets: result.data.facets });
}
