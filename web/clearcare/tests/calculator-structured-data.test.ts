import assert from "node:assert/strict";
import { test } from "node:test";

import { calculatorStructuredData } from "../lib/calculator-structured-data.ts";

test("describes the calculator as a free web application at its full address on the live site", () => {
  const data = calculatorStructuredData("An estimate.");
  assert.equal(data["@type"], "WebApplication");
  assert.equal(data.name, "Fair Deal Calculator");
  assert.equal(data.url, "https://clearcare.ie/guides/fair-deal/calculator");
  assert.equal(data.description, "An estimate.");
  assert.equal(data.isAccessibleForFree, true);
  assert.deepEqual(data.offers, { "@type": "Offer", price: "0", priceCurrency: "EUR" });
  assert.deepEqual(data.provider, { "@type": "Organization", name: "ClearCare", url: "https://clearcare.ie" });
});
