import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

// Every page under app/(site) but the home page has one breadcrumb, through the Breadcrumb
// component or a guide header that renders it. The pages are read as source, because the server
// components that fetch from the API can't be rendered here.
const SITE = join(process.cwd(), "app", "(site)");
// The home page is app/(site)/page.tsx, so its route is "".
const WITHOUT_BREADCRUMB = new Set([""]);
const RENDERS_BREADCRUMB = /<(Breadcrumb|GuideHero|GuideHeader)\b/g;

const pages = readdirSync(SITE, { recursive: true })
  .filter((path): path is string => typeof path === "string" && path.endsWith("page.tsx"))
  .map((path) => path.replaceAll("\\", "/"));

describe("breadcrumbs", () => {
  test("the site's pages are found", () => {
    expect(pages.length).toBeGreaterThan(5);
  });

  for (const page of pages) {
    const route = page.replace(/\/?page\.tsx$/, "");
    if (WITHOUT_BREADCRUMB.has(route)) continue;

    test(`/${route} has one breadcrumb`, () => {
      const source = readFileSync(join(SITE, page), "utf8");
      const found = source.match(RENDERS_BREADCRUMB) ?? [];
      expect(found.length, `found ${found.join(", ") || "none"}`).toBe(1);
    });
  }
});
