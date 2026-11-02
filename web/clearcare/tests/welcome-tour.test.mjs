// tests/welcome-tour.test.mjs
// The welcome tour points at parts of the page by their data-tour attribute. Every one it names
// must be set somewhere, or that step loses its highlight without any error. Each link it points
// at must be in the navigation bar, and the guide's link must start the tour. Read as source, like
// breadcrumb.test.mjs. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const tour = read("components/home/welcome-tour.tsx");

const sources = ["app", "components"]
  .flatMap((dir) => readdirSync(join(ROOT, dir), { recursive: true }).map((path) => join(dir, path)))
  .filter((path) => path.endsWith(".tsx") && !path.endsWith("welcome-tour.tsx"))
  .map(read)
  .join("\n");

const named = [...new Set([...tour.matchAll(/\[data-tour="([^"]+)"\]/g)].map((match) => match[1]))];

// display, nav, menu and guide-links.
test("the tour names the parts it points at", () => {
  assert.ok(named.length >= 4, `only found ${named.join(", ")}`);
});

for (const name of named) {
  test(`data-tour="${name}" is set on the page`, () => {
    assert.equal(sources.split(`data-tour="${name}"`).length - 1, 1, `found ${name} more or less than once`);
  });
}

test("the navigation bar has every link the tour points at", () => {
  const header = read("components/layout/site-header.tsx");
  for (const [, href] of tour.matchAll(/\[data-tour="nav"\] a\[href="([^"]+)"\]/g)) {
    assert.ok(header.includes(`href: "${href}"`), `no ${href} in NAV_ITEMS`);
  }
});

test("the guide's tour link starts the tour", () => {
  assert.ok(read("app/(site)/guides/using-clearcare/page.tsx").includes('href="/?tour"'));
  assert.ok(tour.includes('params.has("tour")'));
});
