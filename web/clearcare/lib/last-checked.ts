// lib/last-checked.ts
// The day a page's facts were last checked against its sources, as a reader sees it under the page
// (components/ui/last-checked.tsx, CCARE-310). A page keeps the day once, as an ISO date
// ("2026-11-13"), and the words are made from it here, so the two can't disagree.

const DAY = new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// "13 November 2026": the month in full, as Support Services has written it since before the other
// pages had a date. formatDate (lib/centres.ts) shortens it, for the tables of a home's record.
export function lastCheckedLabel(date: string) {
  return DAY.format(new Date(date));
}
