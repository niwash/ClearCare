// lib/return-to-centre.ts
// The way back to a home's record from a guide opened from it (CCARE-212). The record's links to a
// guide add ?from=centre&centre=<id>&tab=<tab>, and the guide shows "← Back to the home: <tab>"
// (ReturnLink, components/guides/return-link.tsx), as families opening a guide from a record
// otherwise found no way back but the browser's Back button. Only a centre ID of digits and the
// record's own tabs are accepted, so the address can't point the link anywhere else.
import { sectionFrom } from "./home-address.ts";

// The record's tabs, by the end of their path (CCARE-297), with how the way back names them.
const TABS: Record<string, string> = {
  overview: "Overview",
  "issues-found": "Issues found",
  "how-the-home-responded": "How the home responded",
  inspections: "Inspection history",
  "what-to-ask": "What to ask",
};

// The query a link from the record to a guide carries; tab is the record's tab it's on.
export function returnQuery(centreId: string, tab: keyof typeof TABS = "overview") {
  return new URLSearchParams({ from: "centre", centre: centreId, tab }).toString();
}

// The link back, when the guide's address says it was opened from a record.
export function returnToCentre(params: URLSearchParams): { href: string; label: string } | null {
  if (params.get("from") !== "centre") return null;
  const centre = params.get("centre") ?? "";
  // A tab's address before CCARE-297 (tab=questions in a link opened earlier) is read as its new
  // one. sectionFrom checks its own keys only, so "?tab=constructor" matches nothing.
  const asked = params.get("tab") ?? "overview";
  const tab = asked === "overview" ? asked : sectionFrom(asked);
  if (!/^\d{1,8}$/.test(centre) || !tab) return null;
  // The query names the home by its centre ID only, so the link is the home's old address, which
  // sends it on to its page (app/(site)/centres/[...path]/route.ts, CCARE-297).
  return {
    href: tab === "overview" ? `/centres/${centre}` : `/centres/${centre}/${tab}`,
    label: `Back to the home: ${TABS[tab]}`,
  };
}
