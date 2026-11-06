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
