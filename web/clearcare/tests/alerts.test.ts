// tests/alerts.test.ts
// The alert model (CCARE-271): the API's rows as the site reads them, the request the site is
// allowed to send, and the two orderings the site depends on but does not own — the counties
// (db/V25) and the packages (db/V28). The route handlers are read as source, as the saved-search
// route is (tests/preferences-route.test.ts), because no runner here can hold next-auth.
// Run with: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, test } from "node:test";

import {
  countyId,
  countyName,
  packageForKind,
  parseAlertRequest,
  parsePackages,
  parseSubscription,
  parseSubscriptions,
  SCOPE_OF,
  unsubscribeToken,
} from "../lib/alerts.ts";
import { COUNTIES } from "../lib/counties.ts";

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const sourceFiles = (path: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(new URL(`../${path}`, import.meta.url))) {
    const relative = `${path}/${entry}`;
    const stat = statSync(new URL(`../${relative}`, import.meta.url));
    if (stat.isDirectory()) found.push(...sourceFiles(relative));
    else if (/\.(tsx?|mjs)$/.test(entry)) found.push(relative);
  }
  return found;
};

const centreRow = {
  id: 12,
  package_id: 1,
  title: "Alerts for a nursing home",
  description: "Get an email when a new inspection report is published.",
  scope: "CENTRE",
  centre_id: "187",
  county_id: null,
  created_at: "2026-11-20T09:14:02Z",
};

const countyRow = {
  id: 11,
  package_id: 2,
  title: "Alerts for a county",
  description: null,
  scope: "COUNTY",
  centre_id: null,
  county_id: 4,
  created_at: "2026-11-19T18:02:31Z",
};

describe("a subscription as the API returns it", () => {
  test("a centre row keeps its centre and drops any county", () => {
    const row = parseSubscription(centreRow);
    assert.deepEqual(row, {
      id: 12,
      packageId: 1,
      title: "Alerts for a nursing home",
      description: "Get an email when a new inspection report is published.",
      scope: "CENTRE",
      centreId: "187",
      countyId: null,
      createdAt: "2026-11-20T09:14:02Z",
    });
  });

  test("a county row keeps its county and drops any centre", () => {
    const row = parseSubscription(countyRow);
    assert.equal(row?.scope, "COUNTY");
    assert.equal(row?.countyId, 4);
    assert.equal(row?.centreId, null);
    assert.equal(row?.description, null);
  });

  test("the all-reports row carries neither target", () => {
    const row = parseSubscription({ ...centreRow, package_id: 3, scope: "ALL", centre_id: null });
    assert.equal(row?.centreId, null);
    assert.equal(row?.countyId, null);
  });

  // A CENTRE row with no centre is not something the site could render, so it is unreadable rather
  // than a row with a missing target.
  test("a row whose target is missing for its scope is refused", () => {
    assert.equal(parseSubscription({ ...centreRow, centre_id: null }), null);
    assert.equal(parseSubscription({ ...countyRow, county_id: null }), null);
  });

  test("junk is refused rather than half-read", () => {
    for (const value of [null, undefined, 7, "row", {}, { id: "12" }, { ...centreRow, id: -1 }, { ...centreRow, scope: "HOME" }]) {
      assert.equal(parseSubscription(value), null);
    }
  });

  test("a list drops the rows it cannot read and keeps the order", () => {
    const rows = parseSubscriptions({ subscriptions: [centreRow, { nope: true }, countyRow] });
    assert.deepEqual(
      rows.map((row) => row.id),
      [12, 11],
    );
    assert.deepEqual(parseSubscriptions({ nope: [] }), []);
    assert.deepEqual(parseSubscriptions(null), []);
  });
});

describe("what the site may ask to follow", () => {
  test("a centre follow takes a numeric centre id", () => {
    assert.deepEqual(parseAlertRequest({ scope: "centre", centre_id: "187" }), { kind: "centre", centreId: "187" });
    assert.equal(parseAlertRequest({ scope: "centre", centre_id: "187a" }), null);
    assert.equal(parseAlertRequest({ scope: "centre" }), null);
  });

  test("a county follow takes one of the 26 counties", () => {
    assert.deepEqual(parseAlertRequest({ scope: "county", county_id: 4 }), { kind: "county", countyId: 4 });
    assert.equal(parseAlertRequest({ scope: "county", county_id: 0 }), null);
    assert.equal(parseAlertRequest({ scope: "county", county_id: COUNTIES.length + 1 }), null);
  });

  test("the every-report follow takes no target", () => {
    assert.deepEqual(parseAlertRequest({ scope: "all" }), { kind: "all" });
  });

  // The page names a kind of target, never a package id: the route fills that in from the API.
  test("a package id from the page is not something the site takes", () => {
    for (const value of [null, "all", {}, { scope: "home" }, { scope: "ALL" }, { package_id: 3 }]) {
      assert.equal(parseAlertRequest(value), null);
    }
    // An extra field is ignored, as the API ignores one: the kind of target is what is read.
    assert.deepEqual(parseAlertRequest({ package_id: 3, scope: "all" }), { kind: "all" });
  });
});

describe("the packages the API offers", () => {
  test("are read with whatever ids the database gave them", () => {
    const rows = parsePackages({
      packages: [
        { id: 10, title: "Alerts for a nursing home", description: "Get an email.", scope: "CENTRE" },
        { id: 11, title: "Alerts for a county", description: null, scope: "COUNTY" },
        { nope: true },
      ],
    });
    assert.deepEqual(
      rows.map((row) => row.id),
      [10, 11],
    );
    assert.equal(rows[1].description, null);
  });

  // The whole point (CCARE-271): a package is chosen by its scope, so the ids are the database's.
  test("are matched to a kind of target by scope, not by id", () => {
    const packs = parsePackages({
      packages: [
        { id: 10, title: "A", scope: "CENTRE" },
        { id: 11, title: "B", scope: "COUNTY" },
        { id: 12, title: "C", scope: "ALL" },
      ],
    });
    assert.equal(packageForKind(packs, "centre")?.id, 10);
    assert.equal(packageForKind(packs, "county")?.id, 11);
    assert.equal(packageForKind(packs, "all")?.id, 12);
    assert.equal(packageForKind([], "all"), null);
  });

  test("junk answers are dropped rather than half-read", () => {
    assert.deepEqual(parsePackages(null), []);
    assert.deepEqual(parsePackages({ packages: "three" }), []);
  });
});

describe("the orderings the site does not own", () => {
  // The county id is a row's place in db/V25's seed, plus one: the site lists the same 26 names in
  // the same order (lib/counties.ts), so the two must not drift.
  test("the counties are V25's, in its order", () => {
    const seed = read("../../db/V25__county.sql");
    const names = [...seed.matchAll(/\('([A-Za-z ]+)'\)/g)].map((match) => match[1]);
    assert.deepEqual(names, COUNTIES);
    assert.equal(countyId("Cork"), names.indexOf("Cork") + 1);
    assert.equal(countyId("Wicklow"), 26);
    assert.equal(countyId("Nowhere"), null);
    assert.equal(countyName(1), "Carlow");
    assert.equal(countyName(99), null);
    assert.equal(countyName(null), null);
  });

  // One package per scope, in db/V28's order. The site asks for a scope, not an id, so what it
  // depends on is that every scope the seed creates is one it can name.
  test("every scope V28 seeds is one the site asks for", () => {
    const seed = read("../../db/V28__seed_alert_packages.sql");
    const scopes = [...seed.matchAll(/'(CENTRE|COUNTY|ALL)'/g)].map((match) => match[1]);
    assert.deepEqual(scopes, Object.values(SCOPE_OF));
  });
});

describe("the strip's stop", () => {
  const strip = read("components/alerts/alert-strip.tsx");
  const searchPage = read("app/(site)/search/page.tsx");

  // The every-report strip stands on the search page too, and stopping it must empty the account as
  // the /alerts list does, not remove only its own row and leave homes and counties sending
  // (CCARE-271).
  test("stopping every report goes to the collection route", () => {
    assert.match(strip, /target\.kind === "all"/);
    assert.match(strip, /everything \? "\/api\/alerts\/subscriptions" :/);
  });

  // The filters change the address with router.push, so the strip stays mounted: without a key it
  // would keep the previous county's id, show its state for the new county, and stop the old row
  // (CCARE-271).
  test("the county strip is keyed by the county it names", () => {
    assert.match(searchPage, /<AlertStrip\s+key=\{alertCounty\}/);
  });
});

describe("the unsubscribe token", () => {
  test("is the characters a link's capability can hold", () => {
    assert.equal(unsubscribeToken("abcDEF123_-"), "abcDEF123_-");
    assert.equal(unsubscribeToken("  abc123  "), "abc123");
    assert.equal(unsubscribeToken("has space"), null);
    assert.equal(unsubscribeToken("semi;colon"), null);
    assert.equal(unsubscribeToken(""), null);
    assert.equal(unsubscribeToken(null), null);
    assert.equal(unsubscribeToken("a".repeat(201)), null);
  });
});

describe("the alert routes", () => {
  const add = read("app/api/alerts/subscriptions/route.ts");
  const cancel = read("app/api/alerts/subscriptions/[id]/route.ts");
  const unsubscribe = read("app/api/alerts/unsubscribe/route.ts");

  test("add and cancel take the account from the session, never from the request", () => {
    for (const source of [add, cancel]) {
      assert.match(source, /sessionSubject\(/);
      assert.doesNotMatch(source, /request\.(headers|nextUrl)/);
      assert.doesNotMatch(source, /searchParams/);
    }
  });

  test("add checks the target and reads the package id from the API, never from the page", () => {
    assert.match(add, /parseAlertRequest\(/);
    assert.match(add, /status: 400/);
    // The id is the database's (CCARE-271): it is read at request time, not written into the code.
    assert.match(add, /listPackages\(/);
    assert.match(add, /packageForKind\(/);
    assert.doesNotMatch(add, /package_id:\s*\d/);
  });

  // The every-report alert is the broadest target there is: stopping it empties the account rather
  // than removing one row, and the collection's DELETE is how (CCARE-271).
  test("stopping every report stops the account's alerts through the collection route", () => {
    assert.match(add, /export async function DELETE/);
    assert.match(add, /cancelAllAlerts\(/);
    assert.match(add, /status: 204/);
  });

  test("cancel only answers 204, whether or not the row was still there", () => {
    assert.match(cancel, /status: 204/);
    assert.doesNotMatch(cancel, /404/);
  });

  // The link's route is the one public one: no session, no site token, its own capability.
  test("unsubscribe is a POST with no session and no account header", () => {
    assert.match(unsubscribe, /export async function POST/);
    assert.doesNotMatch(unsubscribe, /sessionSubject|X-ClearCare-Sub|SITE_TOKEN/);
    assert.match(unsubscribe, /searchParams\.get\("token"\)/);
    assert.match(unsubscribe, /status: 404/);
  });

  // A component runs in the browser, so the token must not be reachable from one.
  test("nothing in the browser reaches the API module or its token", () => {
    const offenders = sourceFiles("components").filter(
      (file) => /SITE_TOKEN/.test(read(file)) || /alerts-api/.test(read(file)),
    );
    assert.deepEqual(offenders, [], "only app/ and lib/ may reach the alerts API's token");
  });
});
