// tests/breadcrumb.test.mjs
// Every page under app/(site) but the home page has one breadcrumb, through the Breadcrumb
// component or a guide header that renders it. The pages are read as source, as the server
// components that fetch from the API can't be rendered here. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SITE = join(import.meta.dirname, "..", "app", "(site)");
const WITHOUT_BREADCRUMB = new Set(["home"]);
const RENDERS_BREADCRUMB = /<(Breadcrumb|GuideHero|GuideHeader)\b/g;

const pages = readdirSync(SITE, { recursive: true })
  .filter((path) => path.endsWith("page.tsx"))
  .map((path) => path.replaceAll("\\", "/"));

test("finds the site's pages", () => {
  assert.ok(pages.length > 5, `only found ${pages.join(", ")}`);
});

for (const page of pages) {
  const route = page.replace(/\/?page\.tsx$/, "");
  if (WITHOUT_BREADCRUMB.has(route)) continue;

  test(`/${route} has one breadcrumb`, () => {
    const source = readFileSync(join(SITE, page), "utf8");
    const found = source.match(RENDERS_BREADCRUMB) ?? [];
    assert.equal(found.length, 1, `found ${found.length}: ${found.join(", ") || "none"}`);
  });
}
