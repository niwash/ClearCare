// app/(site)/search/count/route.ts
// How many homes a search would find, and each filter option's count, for the filters sheet on
// phones (SearchFilters): its choices only apply on "Show n nursing homes", so the page's own counts
// are for the search before them. The same parameters as the search page.
import { apiFilterParams } from "@/lib/search-filters";
import { readSearch, searchCentres } from "@/lib/search";

export async function GET(request: Request) {
  const search = readSearch(Object.fromEntries(new URL(request.url).searchParams));
  const result = await searchCentres({ ...search.query, page: "1", page_size: "1" }, apiFilterParams(search.selection));
  if (!result.ok) return Response.json({ detail: result.detail }, { status: result.status || 502 });
  return Response.json({ total: result.data.total, facets: result.data.facets ?? null });
}
