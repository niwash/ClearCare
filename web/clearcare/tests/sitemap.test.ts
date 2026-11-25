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

type ApiCentre = { centre_id: string; centre_name: string; county: string; latest_inspection: { date: string | null } | null };

// A home as GET /centres gives it, with a stored report unless told otherwise.
function centre(centre_id: string, latest_inspection: ApiCentre["latest_inspection"] = { date: "2026-01-15" }): ApiCentre {
  return { centre_id, centre_name: `Home ${centre_id}`, county: "Cork", latest_inspection };
}

// A home as the sitemap is given it.
function listed(centre_id: string, centre_name: string, county: string, hasReport = true) {
  return { centre_id, centre_name, county, hasReport };
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

  assert.deepEqual(centres.map(({ centre_id }) => centre_id), ids);
  assert.equal(asked.length, 3);
});

test("says of each home whether a report of it is stored, dated or not", async () => {
  const api = apiWith([centre("39"), centre("187", { date: null }), centre("9439", null)]);

  assert.deepEqual(await allCentres("https://api.example", api), [
    listed("39", "Home 39", "Cork"),
    listed("187", "Home 187", "Cork"),
    listed("9439", "Home 9439", "Cork", false),
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
  const paths = sitemapPaths([listed("39", "The Glebe", "Wicklow"), listed("187", "St. Joseph’s & Mary’s", "Cork")]);

  assert.equal(paths[0], "/");
  assert.ok(paths.includes("/guides/fair-deal"));
  assert.ok(paths.includes("/national-figures"));
  assert.ok(paths.includes("/support-services"));
  assert.ok(paths.includes("/about"));
  assert.deepEqual(paths.slice(-10), [
    "/nursing-homes/wicklow/the-glebe-39",
    "/nursing-homes/wicklow/the-glebe-39/issues-found",
    "/nursing-homes/wicklow/the-glebe-39/how-the-home-responded",
    "/nursing-homes/wicklow/the-glebe-39/inspections",
    "/nursing-homes/wicklow/the-glebe-39/what-to-ask",
    "/nursing-homes/cork/st-josephs-and-marys-187",
    "/nursing-homes/cork/st-josephs-and-marys-187/issues-found",
    "/nursing-homes/cork/st-josephs-and-marys-187/how-the-home-responded",
    "/nursing-homes/cork/st-josephs-and-marys-187/inspections",
    "/nursing-homes/cork/st-josephs-and-marys-187/what-to-ask",
  ]);
  // A search is a question rather than a page; a comparison and a survey answer are a visitor's own.
  for (const personal of ["/compare", "/search", "/survey"]) assert.ok(!paths.includes(personal));
});

test("a home with no stored report is listed by its overview alone", () => {
  const paths = sitemapPaths([listed("39", "The Glebe", "Wicklow"), listed("9439", "Ard Na Gréine", "Kerry", false)]);

  assert.deepEqual(paths.slice(-6), [
    "/nursing-homes/wicklow/the-glebe-39",
    "/nursing-homes/wicklow/the-glebe-39/issues-found",
    "/nursing-homes/wicklow/the-glebe-39/how-the-home-responded",
    "/nursing-homes/wicklow/the-glebe-39/inspections",
    "/nursing-homes/wicklow/the-glebe-39/what-to-ask",
    "/nursing-homes/kerry/ard-na-greine-9439",
  ]);
});

test("lists each county's page, under the address the page gives as its own", () => {
  const paths = sitemapPaths([]);

  assert.ok(paths.includes("/nursing-homes/cork"));
  for (const county of COUNTIES) {
    const path = `/nursing-homes/${county.toLowerCase()}`;
    assert.ok(paths.includes(path), path);
    assert.equal(countyAloneHref(readSearch({ county })), path);
  }
  assert.equal(paths.filter((path) => path.startsWith("/nursing-homes/")).length, 26);
  assert.ok(!paths.some((path) => path.startsWith("/search")));
});
