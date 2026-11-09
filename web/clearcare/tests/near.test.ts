// tests/near.test.ts
// The point distances are measured from (CCARE-228): rounded to about 1 km before it leaves the
// page, read back from the page address the same way, and how far a home is from it on its card.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { distanceText, nearFrom, readNear } from "../lib/near.ts";

test("a location is rounded to two decimals, about 1 km, before it goes anywhere", () => {
  assert.equal(nearFrom(53.349812, -6.260311), "53.35,-6.26");
  assert.equal(nearFrom(53.3, -6), "53.3,-6");
});

test("a point in the page address is rounded the same way, so a hand-edited link sends nothing finer", () => {
  assert.equal(readNear("53.349812,-6.260311"), "53.35,-6.26");
  assert.equal(readNear("53.35,-6.26"), "53.35,-6.26");
});

test("anything that isn't a latitude and a longitude is no point at all", () => {
  for (const text of ["", "53.35", "53.35,", ",-6.26", "Rathmines", "91,0", "0,181", "53.35,-6.26,1", "1e1,0", "0x10,0", " , "]) {
    assert.equal(readNear(text), "", JSON.stringify(text));
  }
});

test("a distance reads in whole kilometres, since the point is only good to about 1 km", () => {
  assert.equal(distanceText(6300), "About 6 km away (straight line)");
  assert.equal(distanceText(1000), "About 1 km away (straight line)");
  assert.equal(distanceText(1500), "About 2 km away (straight line)");
});

test("under 1 km reads as less than 1 km", () => {
  assert.equal(distanceText(999), "Less than 1 km away (straight line)");
  assert.equal(distanceText(0), "Less than 1 km away (straight line)");
});

test("a home with no distance says nothing", () => {
  assert.equal(distanceText(null), null);
  // An API from before CCARE-226 leaves the field out.
  assert.equal(distanceText(undefined), null);
});
