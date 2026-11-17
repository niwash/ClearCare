// tests/breadcrumb.test.mjs
// Every page under app/(site) but the home page has one breadcrumb, through the Breadcrumb
// component or a guide header that renders it, in the page or in a layout of its own folders (a
// home's record has it in centres/[id]/layout.tsx, for the overview and its subpages, CCARE-212).
// The pages are read as source, as the server components that fetch from the API can't be rendered
// here. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SITE = join(import.meta.dirname, "..", "app", "(site)");
// The home page is app/(site)/page.tsx, so its route is "".
const WITHOUT_BREADCRUMB = new Set([""]);
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
    // The page, and the layouts between it and app/(site), whose own layout has none.
    const files = [page];
    for (let folder = dirname(page); folder !== "."; folder = dirname(folder)) {
      if (existsSync(join(SITE, folder, "layout.tsx"))) files.push(`${folder}/layout.tsx`);
    }
    const source = files.map((file) => readFileSync(join(SITE, file), "utf8")).join("\n");
    const found = source.match(RENDERS_BREADCRUMB) ?? [];
    assert.equal(found.length, 1, `found ${found.length}: ${found.join(", ") || "none"}`);
  });
}
