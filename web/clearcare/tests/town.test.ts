// tests/town.test.ts
// The town a home is in, for its search card and its pin on the map (lib/town.ts). The register has
// no field for it, so it is read from the address.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { town } from "../lib/town.ts";

test("is the last part of the address that isn't the Eircode or the county", () => {
  assert.equal(town({ centre_name: "Elm Hall Nursing Home", address: "Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX", county: "Kildare" }), "Celbridge");
  assert.equal(town({ centre_name: "Áras", address: "Main Street, Swinford, Co. Mayo", county: "Mayo" }), "Swinford");
  assert.equal(town({ centre_name: "Áras", address: "Main Street, Swinford, Mayo, F12 XK75", county: "Mayo" }), "Swinford");
});

test("reads an Eircode the register prints with a letter O for 0 as an Eircode", () => {
  assert.equal(town({ centre_name: "St Anne's", address: "Sea Road, Bray, A98 C2CO", county: "Wicklow" }), "Bray");
});

test("is nothing when the address is only the home's name", () => {
  assert.equal(town({ centre_name: "Elm Hall", address: "Elm Hall, Kildare", county: "Kildare" }), null);
});
