// lib/events.ts
// A home's events from GET /centres/{centre_id}/events (CentreEvent in api/openapi.yaml, CCARE-235):
// its inspections, the changes to its entry on HIQA's register and the changes of its contract
// price, newest first. An event is a kind and that kind's fields and holds no sentence (ADR-0033);
// the words are in components/centre/timeline.tsx. Here are the types, the reader, what the
// timeline works out from the events and the recent changes the overview shows. The tests load this
// file as it is (tests/events.test.ts), so its runtime imports are named with their extension.
import { cache } from "react";
import { apiUrl } from "./api-url.ts";
import type { HomeType, ISODate } from "./centres";

// A regulation inspection whose report was read, with how many regulations got each judgment.
export interface InspectionEvent {
  kind: "inspection";
  date: ISODate | null; // null when neither the report nor HIQA's list gives a date that can be right
  inspection_type: string | null; // HIQA's "Type of inspection" as printed: "Unannounced", "Announced"…
  published_date: ISODate | null; // null when HIQA no longer lists the report
  report_id: number;
  report_url: string;
  compliant: number;
  substantially_compliant: number;
  not_compliant: number;
}

// A thematic inspection: judged against the National Standards, with one overall judgment.
export interface ThematicInspectionEvent {
  kind: "thematic_inspection";
  date: ISODate;
  inspection_type: string | null; // null when no type was read from the report
  published_date: ISODate | null;
  overall_judgment: string; // as printed
  report_url: string;
}

// A report HIQA lists that ClearCare holds no reading of.
export interface UnreadReportEvent {
  kind: "unread_report";
  date: ISODate | null;
  published_date: ISODate;
  report_url: string;
}

// Dated by the registration date. Every register change below it is dated by the day the register
// first showed it, which can be later than the day it happened (ADR-0031).
export interface RegistrationEvent {
  kind: "registration";
  date: ISODate;
  registered_until: ISODate;
}

// A provider is named only when it has a CRO number, so a name can be null.
export interface ProviderEvent {
  kind: "provider";
  date: ISODate;
  before: string | null;
  after: string | null;
}

export interface NameEvent {
  kind: "name";
  date: ISODate;
  before: string;
  after: string;
}

// The most residents HIQA registered the home for; null when the register gave no number.
export interface BedsEvent {
  kind: "beds";
  date: ISODate;
  before: number | null;
  after: number | null;
}

export interface ConditionAddedEvent {
  kind: "condition_added";
  date: ISODate;
  condition_number: number;
  text: string; // HIQA's words
}

export interface ConditionChangedEvent {
  kind: "condition_changed";
  date: ISODate;
  condition_number: number;
  before: string;
  after: string;
}

export interface ConditionRemovedEvent {
  kind: "condition_removed";
  date: ISODate;
  condition_number: number;
  text: string; // the condition as it was
}

export interface NoteAddedEvent {
  kind: "note_added";
  date: ISODate;
  text: string;
}

export interface NoteRemovedEvent {
  kind: "note_removed";
  date: ISODate;
  text: string; // the note as it was
}

// A contract price that differs from the home's price in the list before, in euro per week, dated
// by the list the new price is from.
export interface PriceEvent {
  kind: "price";
  date: ISODate;
  before: number;
  after: number;
  home_type: HomeType;
}

export type CentreEvent =
  | InspectionEvent
  | ThematicInspectionEvent
  | UnreadReportEvent
  | RegistrationEvent
  | ProviderEvent
  | NameEvent
  | BedsEvent
  | ConditionAddedEvent
  | ConditionChangedEvent
  | ConditionRemovedEvent
  | NoteAddedEvent
  | NoteRemovedEvent
  | PriceEvent;

// Every kind the timeline has a row for. A Record, so a kind added to CentreEvent doesn't compile
// until it is listed here too.
const KNOWN_KINDS: Record<CentreEvent["kind"], true> = {
  inspection: true,
  thematic_inspection: true,
  unread_report: true,
  registration: true,
  provider: true,
  name: true,
  beds: true,
  condition_added: true,
  condition_changed: true,
  condition_removed: true,
  note_added: true,
  note_removed: true,
  price: true,
};

interface CentreEventsResult {
  centre_id: string;
  events: { kind: string }[];
}

// null when the events can't be read, including from an API without the route; the pages then show
// what they did before the timeline. A kind this site has no row for yet, as an API deployed ahead
// of it may send, is left out rather than shown without words.
export const getCentreEvents = cache(async (id: string): Promise<CentreEvent[] | null> => {
  const url = apiUrl();
  if (!url) return null;

  let result: CentreEventsResult | null;
  try {
    const response = await fetch(`${url}/centres/${id}/events`, { cache: "no-store" });
    result = response.ok ? await response.json() : null;
  } catch {
    return null;
  }
  if (!Array.isArray(result?.events)) return null;
  return result.events.filter((event): event is CentreEvent => event.kind in KNOWN_KINDS);
});

// One row of the timeline. Rows of one day share its date, so only the first shows it; an event
// with no date shows none.
export interface TimelineRow {
  event: CentreEvent;
  showsDate: boolean;
}

export interface TimelineYear {
  year: number;
  rows: TimelineRow[];
}

// The rows under the year each belongs to, in the API's order, which is newest first. An event with
// no date sits where the API placed it, by the day its report was published.
export function rowsByYear(events: CentreEvent[]): TimelineYear[] {
  const years: TimelineYear[] = [];
  let previousDate: ISODate | null = null;
  for (const event of events) {
    const placedBy = event.date ?? ("published_date" in event ? event.published_date : null);
    if (!placedBy) continue; // the API gives every event one or the other
    const year = Number(placedBy.slice(0, 4));
    if (years.at(-1)?.year !== year) years.push({ year, rows: [] });
    years.at(-1)!.rows.push({ event, showsDate: event.date !== null && event.date !== previousDate });
    previousDate = event.date;
  }
  return years;
}

// Rows shown before the fold. 534 of the 548 homes had eight events or fewer on 12 Nov 2026, so
// nearly every timeline shows whole, and the longest ones don't push the regulations' table far
// down the page.
const FIRST_ROWS = 8;

// Whole years show until they hold FIRST_ROWS rows; the years before them fold. A year is never
// split, so no year's heading is said twice.
export function foldOlderYears(years: TimelineYear[]): { shown: TimelineYear[]; folded: TimelineYear[] } {
  let rows = 0;
  let cut = 0;
  while (cut < years.length && rows < FIRST_ROWS) {
    rows += years[cut].rows.length;
    cut += 1;
  }
  const folded = years.slice(cut);
  // The control takes a row itself, so folding one row would save nothing.
  if (folded.length === 1 && folded[0].rows.length === 1) return { shown: years, folded: [] };
  return { shown: years.slice(0, cut), folded };
}

// What a row says of the notice an inspection had. Nothing for an unannounced one: the timeline says
// once that inspections are without notice unless a row says otherwise. So a row with no type has
// to say the notice isn't known, or that line would call its inspection unannounced. HIQA gives four
// weeks' notice of an announced inspection. Any other type is shown as the report prints it.
export function noticeWords(inspectionType: string | null): string | null {
  switch (inspectionType?.trim().toLowerCase()) {
    case undefined:
    case "":
      return "Notice not known";
    case "unannounced":
      return null;
    case "announced":
      return "With 4 weeks' notice";
    case "short notice announced":
      return "With short notice";
    default:
      return inspectionType;
  }
}

// "+€50" or "−€50". format is formatWeeklyPrice (lib/centres.ts), passed in because that file can't
// be loaded by the tests. Rounded to the cent first: 1295.3 - 1245.1 is 50.200000000000045.
export function priceDifference(before: number, after: number, format: (price: number) => string) {
  const difference = Math.round((after - before) * 100) / 100;
  return `${difference < 0 ? "−" : "+"}${format(Math.abs(difference))}`;
}

// Whether HIQA lists no report for the home: none that was read and none that wasn't. A newly
// registered home has none until its first inspection's report is published.
export function noListedReport(events: CentreEvent[]) {
  return !events.some((event) => event.kind === "inspection" || event.kind === "thematic_inspection" || event.kind === "unread_report");
}

// What the inspections page says under the timeline of a home with no regulation inspection to show:
// that HIQA has published no report, that ClearCare hasn't added the reports yet, or nothing, when
// the timeline already shows the reports HIQA published (a thematic inspection, or a report that
// wasn't read). hiqaCheckedAt is when the home's page on hiqa.ie was last read, null until it has
// been: until then, or without the events, we can't say whose gap it is.
export function missingReportsNote(events: CentreEvent[] | null, hiqaCheckedAt: string | null): "none-published" | "not-added" | null {
  if (events === null) return "not-added";
  if (!noListedReport(events)) return null;
  return hiqaCheckedAt === null ? "not-added" : "none-published";
}

// A change to the home itself: to its entry on HIQA's register or to its contract price.
export type ChangeEvent =
  | ProviderEvent
  | NameEvent
  | BedsEvent
  | ConditionAddedEvent
  | ConditionChangedEvent
  | ConditionRemovedEvent
  | NoteAddedEvent
  | NoteRemovedEvent
  | PriceEvent;

// The kinds the overview's "Recent changes" shows. A kind is listed to be shown, so a new one stays
// off the overview until someone decides it is news. An inspection isn't: the overview's Inspections
// card covers it. Nor is a registration, which is renewed as a matter of course.
const CHANGE_KINDS: Record<ChangeEvent["kind"], true> = {
  provider: true,
  name: true,
  beds: true,
  condition_added: true,
  condition_changed: true,
  condition_removed: true,
  note_added: true,
  note_removed: true,
  price: true,
};

// How many recent changes the overview shows; the rest are counted and are on the timeline.
const RECENT_CHANGES_SHOWN = 3;

// The day six months before this one. A month without that day gives its last: six months before
// 31 August is 28 February, where Date alone would roll over into March.
function sixMonthsBefore(day: ISODate): ISODate {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const lastOfMonth = new Date(Date.UTC(year, month - 6, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 7, Math.min(dayOfMonth, lastOfMonth))).toISOString().slice(0, 10);
}

// The home's changes of the last six months, counted from today (a day, "2026-11-12"): the newest
// three, and how many more there are. A day's changes stay in the API's order.
export function recentChanges(events: CentreEvent[], today: ISODate): { shown: ChangeEvent[]; more: number } {
  const since = sixMonthsBefore(today);
  const recent = events
    .filter((event): event is ChangeEvent => event.kind in CHANGE_KINDS)
    .filter((event) => event.date >= since)
    .sort((a, b) => b.date.localeCompare(a.date));
  return { shown: recent.slice(0, RECENT_CHANGES_SHOWN), more: Math.max(0, recent.length - RECENT_CHANGES_SHOWN) };
}
