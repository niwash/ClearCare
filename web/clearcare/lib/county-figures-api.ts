// lib/county-figures-api.ts
// The figures cover every centre in a county, and GET /centres gives at most 50 per page.
// Keep those pages for a day, as the sitemap does, so turning the list's page can reuse them.
import { cache } from "react";

import { countyFigures, countyFiguresCopy } from "./county-figures";
import { searchCentres } from "./search";

const COUNTY_PAGE_SIZE = 50;
const REVALIDATE_SECONDS = 86400;

async function readCountyPage(county: string, page: number) {
  // Reading the body of a successful response can still throw if the JSON is incomplete.
  const result = await searchCentres(
    { county, page: String(page), page_size: String(COUNTY_PAGE_SIZE) },
    undefined,
    REVALIDATE_SECONDS,
  ).catch(() => null);
  return result?.ok ? result.data : null;
}

// The hero and metadata share the same figures, regardless of the page shown in the list.
export const getCountyFiguresCopy = cache(async (county: string) => {
  const first = await readCountyPage(county, 1);
  if (!first) return null;

  const centres = [...first.centres];
  const lastPage = Math.ceil(first.total / COUNTY_PAGE_SIZE);
  for (let page = 2; page <= lastPage; page++) {
    const next = await readCountyPage(county, page);
    // A partial county or two different register snapshots can't give a county total.
    if (!next || next.register_snapshot.sha256 !== first.register_snapshot.sha256) return null;
    centres.push(...next.centres);
  }
  return countyFiguresCopy(county, countyFigures(centres));
});
