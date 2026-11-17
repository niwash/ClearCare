// lib/counties.ts
// The counties the API accepts, in the order its enum lists them (api/openapi.yaml). They live here,
// apart from lib/search.ts, because that file reads the API and cannot be loaded by the tests that
// check a saved search (tests/preferences.test.ts).
export const COUNTIES = [
  "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry", "Kildare",
  "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath", "Monaghan",
  "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath", "Wexford", "Wicklow",
];

// The county list's "Any county" value. It means no county, as a blank does.
export const ANY_COUNTY = "any";

// The county that text typed into a search box names, as the API spells it, or null. "co cavan" and
// "County Cavan" are Cavan; "Cavan Town" isn't. "Co" needs a dot or a space after it, so that Cork
// keeps its "Co".
export function countyNamed(text: string) {
  const bare = text.trim().replace(/^(co\.|co\s|county\s)\s*/i, "").toLowerCase();
  return COUNTIES.find((county) => county.toLowerCase() === bare) ?? null;
}

// How many centres each county has among the points of the map, for "Browse by county" before
// anything is searched (CCARE-230). A centre ClearCare has no location for has no point, so a
// county's number can be lower than its search finds. A county with no point at all is left out:
// it can't be told from a county with no nursing home, and its link would say "0 homes".
export function centresByCounty(points: { county: string }[]) {
  return COUNTIES.map((county) => ({ county, centres: points.filter((point) => point.county === county).length })).filter(
    ({ centres }) => centres > 0,
  );
}
