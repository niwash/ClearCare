// tests/events.test.ts
// A home's events from GET /centres/{centre_id}/events (lib/events.ts, CCARE-235): how they are read,
// and what the timeline works out from them: its years, which years fold, the words for an
// inspection's notice, a price's difference, whether HIQA lists a report at all, and what the page
// says of a home with no regulation inspection to show. And the recent changes the overview shows.
// The API is a fetch each test replaces.
// Run with: npm test
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test, type TestContext } from "node:test";

import {
  foldOlderYears,
  getCentreEvents,
  missingReportsNote,
  noListedReport,
  noticeWords,
  priceDifference,
  recentChanges,
  rowsByYear,
  type CentreEvent,
} from "../lib/events.ts";

const inspection = (date: string | null, published: string | null = "2026-07-31"): CentreEvent => ({
  kind: "inspection",
  date,
  inspection_type: "Unannounced",
  published_date: published,
  report_id: 406,
  report_url: "https://www.hiqa.ie/report-406.pdf",
  compliant: 6,
  substantially_compliant: 3,
  not_compliant: 4,
});
const registration = (date: string): CentreEvent => ({ kind: "registration", date, registered_until: "2029-10-29" });
const beds = (date: string): CentreEvent => ({ kind: "beds", date, before: 50, after: 47 });
const renamed = (date: string): CentreEvent => ({ kind: "name", date, before: "Elm Hall", after: "Elm Court" });
const price = (date: string): CentreEvent => ({ kind: "price", date, before: 1245, after: 1295, home_type: "private" });
const thematicInspection: CentreEvent = {
  kind: "thematic_inspection",
  date: "2026-02-05",
  inspection_type: "Unannounced",
  published_date: "2026-04-15",
  overall_judgment: "Substantially Compliant",
  report_url: "https://www.hiqa.ie/thematic.pdf",
};
const unreadReport: CentreEvent = {
  kind: "unread_report",
  date: "2024-01-12",
  published_date: "2024-03-21",
  report_url: "https://www.hiqa.ie/unread.pdf",
};

// A year with this many inspections, a month apart.
const inspections = (year: number, count: number) =>
  Array.from({ length: count }, (_, index) => inspection(`${year}-${String(12 - index).padStart(2, "0")}-01`));

describe("a home's events", () => {
  const environment = { ...process.env };
  beforeEach(() => {
    process.env.API_URL = "http://api.test/";
  });
  afterEach(() => {
    process.env = { ...environment };
  });

  // The API answering every request with this, and the addresses it was asked for.
  function api(context: TestContext, status: number, body: unknown) {
    const asked: string[] = [];
    context.mock.method(globalThis, "fetch", async (url: string) => {
      asked.push(url);
      return Response.json(body, { status });
    });
    return asked;
  }

  test("are read from the centre's events route, in the API's order", async (context) => {
    const events = [beds("2026-11-03"), inspection("2026-04-17")];
    const asked = api(context, 200, { centre_id: "34", events });

    assert.deepEqual(await getCentreEvents("34"), events);
    assert.deepEqual(asked, ["http://api.test/centres/34/events"]);
  });

  test("are null from an API without the route", async (context) => {
    api(context, 404, { title: "Not Found", status: 404 });
    assert.equal(await getCentreEvents("34"), null);
  });

  test("are null when the API can't be reached", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
      throw new TypeError("fetch failed");
    });
    assert.equal(await getCentreEvents("34"), null);
  });

  test("are null when API_URL isn't set", async () => {
    delete process.env.API_URL;
    assert.equal(await getCentreEvents("34"), null);
  });

  test("are null when the answer has no list of events", async (context) => {
    api(context, 200, { centre_id: "34" });
    assert.equal(await getCentreEvents("34"), null);
  });

  test("leave out a kind the timeline has no row for, as a newer API may send", async (context) => {
    const known = registration("2026-10-30");
    api(context, 200, { centre_id: "34", events: [{ kind: "enforcement", date: "2026-11-01" }, known] });
    assert.deepEqual(await getCentreEvents("34"), [known]);
  });
});

describe("the timeline's years", () => {
  test("hold the rows of each year, newest first, in the API's order", () => {
    const events = [beds("2026-11-03"), price("2026-10-14"), inspection("2025-10-03"), registration("2022-01-04")];
    const years = rowsByYear(events);

    assert.deepEqual(
      years.map((year) => year.year),
      [2026, 2025, 2022],
    );
    assert.deepEqual(
      years[0].rows.map((row) => row.event),
      [events[0], events[1]],
    );
  });

  test("show a day's date on its first row only, so rows of one day share it", () => {
    const [year] = rowsByYear([renamed("2026-11-03"), beds("2026-11-03"), price("2026-10-14")]);
    assert.deepEqual(
      year.rows.map((row) => row.showsDate),
      [true, false, true],
    );
  });

  test("place an event with no date in the year its report was published, and show no date for it", () => {
    const years = rowsByYear([inspection("2026-02-01"), inspection(null, "2025-03-16"), inspection("2024-11-18")]);
    assert.deepEqual(
      years.map((year) => year.year),
      [2026, 2025, 2024],
    );
    assert.equal(years[1].rows[0].showsDate, false);
  });
});

describe("the fold", () => {
  const rowCount = (years: { rows: unknown[] }[]) => years.reduce((count, year) => count + year.rows.length, 0);

  test("leaves a timeline of eight rows whole", () => {
    const years = rowsByYear([...inspections(2026, 3), ...inspections(2025, 3), ...inspections(2024, 2)]);
    const { shown, folded } = foldOlderYears(years);
    assert.equal(rowCount(shown), 8);
    assert.deepEqual(folded, []);
  });

  test("shows whole years until they hold eight rows, and folds the years before them", () => {
    const years = rowsByYear([...inspections(2026, 5), ...inspections(2025, 3), ...inspections(2024, 3), ...inspections(2023, 2)]);
    const { shown, folded } = foldOlderYears(years);
    assert.deepEqual(
      shown.map((year) => year.year),
      [2026, 2025],
    );
    assert.deepEqual(
      folded.map((year) => year.year),
      [2024, 2023],
    );
  });

  test("never splits a year, however many rows it has", () => {
    const years = rowsByYear([...inspections(2026, 10), ...inspections(2025, 2)]);
    const { shown, folded } = foldOlderYears(years);
    assert.equal(rowCount(shown), 10);
    assert.equal(rowCount(folded), 2);
  });

  test("doesn't fold one row on its own, since the control would take the row's place", () => {
    const years = rowsByYear([...inspections(2026, 8), registration("2022-01-04")]);
    const { shown, folded } = foldOlderYears(years);
    assert.equal(rowCount(shown), 9);
    assert.deepEqual(folded, []);
  });
});

describe("the notice an inspection had", () => {
  test("is four weeks for an announced inspection", () => {
    assert.equal(noticeWords("Announced"), "With 4 weeks' notice");
  });

  test("is short for a short notice announced inspection", () => {
    assert.equal(noticeWords("Short Notice Announced"), "With short notice");
  });

  test("is not said of an unannounced inspection, which the timeline's heading covers", () => {
    assert.equal(noticeWords("Unannounced"), null);
  });

  test("is not known when no type was read, so the heading isn't taken to cover the row", () => {
    assert.equal(noticeWords(null), "Notice not known");
    assert.equal(noticeWords(" "), "Notice not known");
  });

  test("is read whatever the case the report prints the type in", () => {
    assert.equal(noticeWords("Short notice announced "), "With short notice");
    assert.equal(noticeWords("unannounced"), null);
  });

  test("is any other type as the report prints it", () => {
    assert.equal(noticeWords("Monitoring"), "Monitoring");
  });
});

describe("a price's difference", () => {
  const euro = (price: number) => `€${price}`;

  test("is a plus for a rise", () => {
    assert.equal(priceDifference(1245, 1295, euro), "+€50");
  });

  test("is a minus for a fall", () => {
    assert.equal(priceDifference(1295, 1245, euro), "−€50");
  });

  test("is to the cent, not what binary arithmetic leaves", () => {
    // 1295.3 - 1245.1 is 50.200000000000045 as it stands.
    assert.equal(priceDifference(1245.1, 1295.3, euro), "+€50.2");
  });
});

describe("a home with no listed report", () => {
  test("is one whose events are register changes and prices alone", () => {
    assert.equal(noListedReport([registration("2026-06-15"), beds("2026-11-03"), price("2026-10-14")]), true);
  });

  test("is not one with a report that was read", () => {
    assert.equal(noListedReport([registration("2026-06-15"), inspection("2026-04-17")]), false);
    assert.equal(noListedReport([thematicInspection]), false);
  });

  test("is not one with a report HIQA lists that hasn't been read", () => {
    assert.equal(noListedReport([unreadReport]), false);
  });
});

describe("what the page says of a home with no regulation inspection to show", () => {
  const hiqaCheckedAt = "2026-11-12T06:30:00Z";

  test("is that HIQA has published none, once its page on hiqa.ie was read and lists no report", () => {
    assert.equal(missingReportsNote([registration("2026-06-15")], hiqaCheckedAt), "none-published");
  });

  test("is nothing when the timeline shows a thematic inspection or a report that wasn't read", () => {
    assert.equal(missingReportsNote([registration("2026-06-15"), thematicInspection], hiqaCheckedAt), null);
    assert.equal(missingReportsNote([unreadReport], hiqaCheckedAt), null);
    assert.equal(missingReportsNote([unreadReport], null), null);
  });

  test("is that we haven't added them, until the home's page on hiqa.ie has been read", () => {
    assert.equal(missingReportsNote([registration("2026-06-15")], null), "not-added");
  });

  test("is that we haven't added them, when the events couldn't be read", () => {
    assert.equal(missingReportsNote(null, hiqaCheckedAt), "not-added");
  });
});

describe("a home's recent changes", () => {
  const today = "2026-11-12";

  test("are its changes of provider, name, beds, conditions, note and price", () => {
    const changes: CentreEvent[] = [
      { kind: "provider", date: "2026-11-03", before: "Elm Care Ltd", after: "Oak Care Ltd" },
      renamed("2026-11-03"),
      beds("2026-11-03"),
      { kind: "condition_added", date: "2026-10-20", condition_number: 4, text: "No new admissions." },
      { kind: "condition_changed", date: "2026-10-19", condition_number: 5, before: "By June.", after: "By July." },
      { kind: "condition_removed", date: "2026-10-18", condition_number: 6, text: "By May." },
      { kind: "note_added", date: "2026-10-17", text: "Under appeal." },
      { kind: "note_removed", date: "2026-10-16", text: "Under appeal." },
      price("2026-10-14"),
    ];
    for (const change of changes) assert.deepEqual(recentChanges([change], today).shown, [change]);
  });

  test("leave out inspections and reports, which the overview's Inspections card covers", () => {
    assert.deepEqual(recentChanges([inspection("2026-11-01"), thematicInspection, unreadReport], "2026-03-01"), { shown: [], more: 0 });
  });

  test("leave out a registration, which is renewed as a matter of course", () => {
    assert.deepEqual(recentChanges([registration("2026-10-30")], today), { shown: [], more: 0 });
  });

  test("include a change dated six months ago to the day", () => {
    const change = beds("2026-05-12");
    assert.deepEqual(recentChanges([change], today).shown, [change]);
  });

  test("leave out a change a day older than six months", () => {
    assert.deepEqual(recentChanges([beds("2026-05-11")], today).shown, []);
  });

  test("count six months back to a shorter month's last day, when it has no such day", () => {
    // Six months before 31 August is 28 February: there is no 31 February to count from.
    const change = beds("2026-02-28");
    assert.deepEqual(recentChanges([change], "2026-08-31").shown, [change]);
    assert.deepEqual(recentChanges([beds("2026-02-27")], "2026-08-31").shown, []);
  });

  test("are newest first, and a day's changes stay in the API's order", () => {
    const [older, newer, sameDay] = [price("2026-10-14"), renamed("2026-11-03"), beds("2026-11-03")];
    assert.deepEqual(recentChanges([older, newer, sameDay], today).shown, [newer, sameDay, older]);
  });

  test("are three at most, with how many more there are", () => {
    const changes = [renamed("2026-11-03"), beds("2026-11-03"), price("2026-10-14"), beds("2026-09-01"), price("2026-07-08")];
    assert.deepEqual(recentChanges(changes, today), { shown: changes.slice(0, 3), more: 2 });
  });

  test("are none for a home with no events", () => {
    assert.deepEqual(recentChanges([], today), { shown: [], more: 0 });
  });
});
