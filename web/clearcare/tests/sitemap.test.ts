// tests/sitemap.test.ts
// The list of pages a search engine is given (lib/sitemap.ts): the pages every visitor can open, and
// one for each home the API serves.
// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";

import { allCentreIds, sitemapPaths } from "../lib/sitemap.ts";

// An API with these homes, answering GET /centres a page at a time.
function apiWith(ids: string[], asked: string[] = []) {
  return async (url: string) => {
    asked.push(url);
    const params = new URL(url).searchParams;
    const page = Number(params.get("page"));
    const size = Number(params.get("page_size"));
    const centres = ids.slice((page - 1) * size, page * size).map((centre_id) => ({ centre_id }));
    return new Response(JSON.stringify({ centres, total: ids.length }));
  };
}

test("reads every page of the register", async () => {
  const ids = Array.from({ length: 120 }, (_, index) => String(index + 1));
  const asked: string[] = [];

  assert.deepEqual(await allCentreIds("https://api.example", apiWith(ids, asked)), ids);
  assert.equal(asked.length, 3);
});

test("an empty register is no homes, from one request", async () => {
  const asked: string[] = [];

  assert.deepEqual(await allCentreIds("https://api.example", apiWith([], asked)), []);
  assert.equal(asked.length, 1);
});

test("fails when the API does, so a sitemap never lists the site without its homes", async () => {
  const down = async () => new Response("no", { status: 503 });

  await assert.rejects(allCentreIds("https://api.example", down), /GET \/centres answered 503/);
});

test("lists the site's own pages, then each home's overview", () => {
  const paths = sitemapPaths(["39", "187"]);

  assert.equal(paths[0], "/");
  assert.ok(paths.includes("/guides/fair-deal"));
  assert.deepEqual(paths.slice(-2), ["/centres/39", "/centres/187"]);
  // A search is a question rather than a page; a comparison and a survey answer are a visitor's own.
  for (const personal of ["/compare", "/search", "/survey"]) assert.ok(!paths.includes(personal));
});
