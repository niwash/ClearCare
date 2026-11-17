// lib/api-url.ts
// Where the ClearCare API is. It lives here, apart from lib/search.ts, because that file imports
// next/server and the tests of the map's points load this one as it is (tests/points-api.test.ts).

// The API's base URL, or null if it isn't set.
export function apiUrl() {
  return process.env.API_URL?.replace(/\/$/, "") || null;
}
