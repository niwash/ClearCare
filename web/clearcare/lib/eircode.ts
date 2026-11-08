// lib/eircode.ts
// Telling an Eircode from other text typed into a search box. It lives here, apart from lib/search.ts,
// because that file reads the API and cannot be loaded by the tests of the home page box
// (tests/home-search.test.ts).
const ROUTING_KEY = /^([AC-FHKNPRTV-Y]\d{2}|D6W)$/;
const FULL_EIRCODE = /^([AC-FHKNPRTV-Y]\d{2}|D6W)[0-9AC-FHKNPRTV-Y]{4}$/;

// "D06", "w23 p6ex" and "W23P6EX" are Eircodes; "Elm Hall" isn't.
export function looksLikeEircode(text: string) {
  const compact = text.replace(/\s+/g, "").toUpperCase();
  return ROUTING_KEY.test(compact) || FULL_EIRCODE.test(compact);
}
