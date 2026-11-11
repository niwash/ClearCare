// tests/points-api.test.ts
// What the search page's map asks the API for (lib/points-api.ts): the points of the same search,
// or of every home before one, with the token that says the request is the site's own (ADR-0029),
// and what the page is told when they can't be read. The API is a fetch each test replaces.
// Run with: npm test
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test, type TestContext } from "node:test";

import { readSearch } from "../lib/page-search.ts";
import { pointsConfigured, readPoints } from "../lib/points-api.ts";

const ELM_HALL = {
  centre_id: "34",
  centre_name: "Elm Hall Nursing Home",
  address: "Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX",
  county: "Kildare",
  latitude: 53.34,
  longitude: -6.54,
  distance_m: null,
};

// The API answering every request with this, and the requests it was sent.
function api(context: TestContext, status: number, body: unknown) {
  const requests: { url: URL; init: RequestInit }[] = [];
  context.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests.push({ url: new URL(url), init });
    return Response.json(body, { status });
  });
  return requests;
}

describe("the points of a search", () => {
  const environment = { ...process.env };
  beforeEach(() => {
    process.env.API_URL = "http://api.test/";
    process.env.SITE_TOKEN = "the-sites-own-token";
  });
  afterEach(() => {
    process.env = { ...environment };
  });

  test("are asked for with what the search matches and measures from, and never an order or a page", async (context) => {
    const requests = api(context, 200, { points: [ELM_HALL], register_snapshot: {} });
    const search = readSearch({
      name: "elm",
      county: "Kildare",
      care: "dementia,respite",
      place: "Celbridge, Kildare",
      near: "53.34,-6.54",
      sort: "distance",
      page: "3",
      page_size: "10",
      view: "map",
    });

    const answer = await readPoints(search);

    assert.deepEqual(answer, { ok: true, points: [ELM_HALL] });
    assert.equal(requests.length, 1);
    const { url } = requests[0];
    assert.equal(url.origin + url.pathname, "http://api.test/centres/points");
    assert.deepEqual([...url.searchParams].sort(), [
      ["care_type", "Dementia care"],
      ["care_type", "Respite care"],
      ["county", "Kildare"],
      ["name", "elm"],
      ["near", "53.34,-6.54"],
    ]);
  });

  test("are every home's when nothing is searched: the request names nothing to match", async (context) => {
    const requests = api(context, 200, { points: [ELM_HALL], register_snapshot: {} });

    // An order and a view can be in the address without a search.
    const answer = await readPoints(readSearch({ sort: "latest_inspection", view: "map" }));

    assert.deepEqual(answer, { ok: true, points: [ELM_HALL] });
    assert.deepEqual([...requests[0].url.searchParams], []);
  });

  test("are asked for as the site, and never from a cache", async (context) => {
    const requests = api(context, 200, { points: [], register_snapshot: {} });

    await readPoints(readSearch({ county: "Kildare" }));

    const { init } = requests[0];
    assert.equal(new Headers(init.headers).get("X-ClearCare-Token"), "the-sites-own-token");
    assert.equal(init.cache, "no-store");
  });

  test("are not asked for by a site without the token", async (context) => {
    const requests = api(context, 200, { points: [ELM_HALL] });
    delete process.env.SITE_TOKEN;

    const answer = await readPoints(readSearch({ county: "Kildare" }));

    assert.equal(pointsConfigured(), false);
    assert.equal(answer.ok, false);
    assert.equal(!answer.ok && answer.reason, "unconfigured");
    assert.equal(requests.length, 0);
  });

  test("say why when the API refuses", async (context) => {
    api(context, 401, { title: "Unauthorized", status: 401, detail: "The request is not from the site." });

    const answer = await readPoints(readSearch({ county: "Kildare" }));

    assert.deepEqual(answer, { ok: false, reason: "refused", status: 401, detail: "The request is not from the site." });
  });

  test("say so when the API can't be reached, without throwing", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
      throw new TypeError("fetch failed");
    });

    const answer = await readPoints(readSearch({ county: "Kildare" }));

    assert.equal(answer.ok, false);
    assert.equal(!answer.ok && answer.reason, "unreachable");
  });

  test("say so when the answer is cut off after its headers, without throwing", async (context) => {
    context.mock.method(globalThis, "fetch", async () => new Response("{\"points\": [", { status: 200 }));

    const answer = await readPoints(readSearch({ county: "Kildare" }));

    assert.equal(!answer.ok && answer.reason, "unreachable");
  });
});
