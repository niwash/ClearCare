// tests/sitemap.test.ts
// The list of pages a search engine is given (lib/sitemap.ts): the pages every visitor can open, each
// county's page, and for each home the API serves its overview, with its four tabs when a report of
// it is stored.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { COUNTIES } from "../lib/counties.ts";
import { countyAloneHref, readSearch } from "../lib/page-search.ts";
import { allCentres, sitemapPaths } from "../lib/sitemap.ts";

type ApiCentre = { centre_id: string; latest_inspection: { date: string | null } | null };

// A home as GET /centres gives it, with a stored report unless told otherwise.
function centre(centre_id: string, latest_inspection: ApiCentre["latest_inspection"] = { date: "2026-01-15" }): ApiCentre {
  return { centre_id, latest_inspection };
}

// An API with these homes, answering GET /centres a page at a time.
function apiWith(all: ApiCentre[], asked: string[] = []) {
  return async (url: string) => {
    asked.push(url);
    const params = new URL(url).searchParams;
    const page = Number(params.get("page"));
    const size = Number(params.get("page_size"));
    const centres = all.slice((page - 1) * size, page * size);
    return new Response(JSON.stringify({ centres, total: all.length }));
  };
}

test("reads every page of the register", async () => {
  const ids = Array.from({ length: 120 }, (_, index) => String(index + 1));
  const asked: string[] = [];

  const centres = await allCentres("https://api.example", apiWith(ids.map((id) => centre(id)), asked));

  assert.deepEqual(centres.map(({ id }) => id), ids);
  assert.equal(asked.length, 3);
});

test("says of each home whether a report of it is stored, dated or not", async () => {
  const api = apiWith([centre("39"), centre("187", { date: null }), centre("9439", null)]);

  assert.deepEqual(await allCentres("https://api.example", api), [
    { id: "39", hasReport: true },
    { id: "187", hasReport: true },
    { id: "9439", hasReport: false },
  ]);
});

test("an empty register is no homes, from one request", async () => {
  const asked: string[] = [];

  assert.deepEqual(await allCentres("https://api.example", apiWith([], asked)), []);
  assert.equal(asked.length, 1);
});

test("fails when the API does, so a sitemap never lists the site without its homes", async () => {
  const down = async () => new Response("no", { status: 503 });

  await assert.rejects(allCentres("https://api.example", down), /GET \/centres answered 503/);
});

test("lists the site's own pages, then each home's overview and its four tabs", () => {
  const paths = sitemapPaths([
    { id: "39", hasReport: true },
    { id: "187", hasReport: true },
  ]);

  assert.equal(paths[0], "/");
  assert.ok(paths.includes("/guides/fair-deal"));
  assert.deepEqual(paths.slice(-10), [
    "/centres/39",
    "/centres/39/look-first",
    "/centres/39/next-steps",
    "/centres/39/inspections",
    "/centres/39/questions",
    "/centres/187",
    "/centres/187/look-first",
    "/centres/187/next-steps",
    "/centres/187/inspections",
    "/centres/187/questions",
  ]);
  // A search is a question rather than a page; a comparison and a survey answer are a visitor's own.
  for (const personal of ["/compare", "/search", "/survey"]) assert.ok(!paths.includes(personal));
});

test("a home with no stored report is listed by its overview alone", () => {
  const paths = sitemapPaths([
    { id: "39", hasReport: true },
    { id: "9439", hasReport: false },
  ]);

  assert.deepEqual(paths.slice(-6), [
    "/centres/39",
    "/centres/39/look-first",
    "/centres/39/next-steps",
    "/centres/39/inspections",
    "/centres/39/questions",
    "/centres/9439",
  ]);
});

test("lists each county's page, under the address the page gives as its own", () => {
  const paths = sitemapPaths([]);

  assert.ok(paths.includes("/search?county=Cork"));
  for (const county of COUNTIES) {
    const path = `/search?county=${county}`;
    assert.ok(paths.includes(path), path);
    assert.equal(countyAloneHref(readSearch({ county })), path);
  }
  assert.equal(paths.filter((path) => path.startsWith("/search")).length, 26);
});
