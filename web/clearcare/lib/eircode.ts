// lib/eircode.ts
// Telling an Eircode from other text typed into a search box. It lives here, apart from lib/search.ts,
// because that file reads the API and cannot be loaded by the tests of the home page box
// (tests/home-search.test.ts).
const ROUTING_KEY = /^([AC-FHKNPRTV-Y]\d{2}|D6W)$/;
const FULL_EIRCODE = /^([AC-FHKNPRTV-Y]\d{2}|D6W)[0-9AC-FHKNPRTV-Y]{4}$/;

// "w23 p6ox" → "W23P60X", "D06" → "D06", "Elm Hall" → null. Eircodes have no letter O, so an O
// is read as 0, but only when the routing key, the first three characters, already holds a digit.
// Every routing key has a digit that is not 0 (W23, D06, D6W), so an Eircode typed with O for 0
// still shows one there, while a word that starts with a letter and two Os, such as Doonane or
// Doonan 1, stays a word. The register load does the same (_eircode in
// pipeline/src/clearcare_pipeline/load_register/register_csv.py).
export function asEircode(text: string) {
  let compact = text.replace(/\s+/g, "").toUpperCase();
  if (/\d/.test(compact.slice(0, 3))) compact = compact.replaceAll("O", "0");
  return ROUTING_KEY.test(compact) || FULL_EIRCODE.test(compact) ? compact : null;
}
