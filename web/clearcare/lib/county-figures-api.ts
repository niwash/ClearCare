// lib/county-figures-api.ts
// The figures cover every centre in a county, and GET /centres gives at most 50 per page. Every
// page is read fresh on each request, as the list is, so the figures are from the same register as
// the list under them. That costs one to three more requests on a county's page.
import { cache } from "react";

import { countyFigures, countyFiguresCopy } from "./county-figures";
import { searchCentres } from "./search";

const COUNTY_PAGE_SIZE = 50;

async function readCountyPage(county: string, page: number) {
  const result = await searchCentres({ county, page: String(page), page_size: String(COUNTY_PAGE_SIZE) });
  return result.ok ? result.data : null;
}

// The hero and metadata share the same figures, regardless of the page shown in the list.
export const getCountyFiguresCopy = cache(async (county: string) => {
  const first = await readCountyPage(county, 1);
  if (!first || first.total === 0) return null;

  // The first page says how many there are. The rest are read together, as the request waits for them.
  const lastPage = Math.ceil(first.total / COUNTY_PAGE_SIZE);
  const rest = await Promise.all(Array.from({ length: lastPage - 1 }, (_, index) => readCountyPage(county, index + 2)));

  const centres = [...first.centres];
  for (const next of rest) {
    // A partial county or two different register snapshots can't give a county total.
    if (!next || next.register_snapshot.sha256 !== first.register_snapshot.sha256) return null;
    centres.push(...next.centres);
  }
  return countyFiguresCopy(county, countyFigures(centres));
});
