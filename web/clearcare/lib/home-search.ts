// lib/home-search.ts
// Where the home page box sends what was typed into it. The box sends q to the search page, which
// redirects to the search this returns (app/(site)/search/page.tsx).
//
// Imports are named with their extension: the tests load this file as it is
// (tests/home-search.test.ts), and lib/search.ts reads the API (next/server), so it cannot be one
// of them.
import { countyNamed } from "./counties.ts";
import { looksLikeEircode } from "./eircode.ts";

// The API has no combined search, so the text goes on as one field. A county goes to the county
// filter: as a name it finds only homes named after it, and as an address it misses the homes whose
// address leaves the county out. An empty box goes on as an empty name, so it gets the same "Please enter
// something" as an empty search on the search page.
export function homeSearchHref(text: string) {
  const q = text.trim();
  if (!q) return "/search?name=";
  const county = countyNamed(q);
  if (county) return `/search?${new URLSearchParams({ county })}`;
  return `/search?${new URLSearchParams({ [looksLikeEircode(q) ? "place" : "name"]: q })}`;
}
