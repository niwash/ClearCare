// lib/centre-record.ts
// Everything a centre's pages show (CCARE-212): the register entry, its inspection reports with the
// highlights and promise trails added from the findings (CCARE-207), what the home offers, and the
// events of its timeline (CCARE-235). The layout and each subpage ask for it; cache() loads it once
// per request, as getCentre and the others already are.
import { cache } from "react";
import type { CentreTab } from "@/components/centre/centre-tabs";
import { centreDescription } from "@/lib/centre-description";
import {
  formatDate,
  formatWeeklyPrice,
  getCentre,
  getCentreAmenities,
  getCentreFindings,
  getCentreReports,
  getHiqaCheckedAt,
  type CentreAmenities,
  type CentreDetail,
  type CentreReports,
} from "@/lib/centres";
import { getCentreEvents, markNoLongerOnline, type CentreEvent } from "@/lib/events";
import { addFindings } from "@/lib/findings";
import { townAndCounty } from "@/lib/town";

export type CentreRecord =
  | { status: "not-found" }
  | { status: "unavailable"; httpStatus: number }
  | {
      status: "found";
      centre: CentreDetail;
      reports: CentreReports | null;
      amenities: CentreAmenities | null;
      // Newest first. null when they couldn't be read, including from an API without the route;
      // the pages then show no timeline.
      events: CentreEvent[] | null;
      // When ClearCare last read the home's page on hiqa.ie for new reports; null until it has.
      hiqaCheckedAt: string | null;
      // false when the findings couldn't be read, so the pages built from them don't say nothing
      // stands out when they simply don't know.
      findingsRead: boolean;
      // Whether any report has a compliance plan: the home's response to a finding, or a date to
      // comply by. A page can't say every plan was checked of a home that never had one.
      hasCompliancePlan: boolean;
    };

export const getCentreRecord = cache(async (id: string): Promise<CentreRecord> => {
  const lookup = await getCentre(id);
  if (lookup.status === "not-found") return { status: "not-found" };
  if (lookup.status === "unavailable") return { status: "unavailable", httpStatus: lookup.httpStatus };
  const [baseReports, amenities, findings, events, hiqaCheckedAt] = await Promise.all([
    getCentreReports(id),
    getCentreAmenities(id),
    getCentreFindings(id),
    getCentreEvents(id),
    getHiqaCheckedAt(id),
  ]);
  // Without findings the reports have no highlights or trails, and the pages show the history alone.
  return {
    status: "found",
    centre: lookup.centre,
    reports: baseReports && addFindings(baseReports, findings),
    amenities,
    // A report HIQA no longer has online links to an email asking HIQA for it (CCARE-236), as
    // getCentreReports leaves out its file.
    events: events && markNoLongerOnline(events, hiqaCheckedAt, lookup.centre.centre_id),
    hiqaCheckedAt,
    findingsRead: findings !== null,
    hasCompliancePlan: (findings ?? []).some(
      (finding) => finding.compliance_items.length > 0 || finding.provider_response !== null || Boolean(finding.stated_deadlines?.length),
    ),
  };
});

// The record's pages: the overview, and a subpage for each long section.
export type CentreSection = "look-first" | "inspections" | "next-steps" | "questions";

// All four tabs on every home, so a family finds the same ones each time; a page with nothing on it
// says why (NothingToFlag, and the inspections page's own message when there are no reports). Each
// tab is coloured like the band its page starts with, so the current one runs into it. How the home
// responded follows Issues found, as it follows up the same regulations; the full inspection
// history after them, and What to ask last, as what the family can do with it all. Read by the
// record's layout and by the Overview, which places its own pager (CCARE-258).
export function centreTabs(id: string): CentreTab[] {
  return [
    { href: centrePath(id), label: "Overview", band: "bg-page" },
    { href: centrePath(id, "look-first"), label: CENTRE_SECTION_TITLES["look-first"], band: "bg-tint-gold" },
    { href: centrePath(id, "next-steps"), label: CENTRE_SECTION_TITLES["next-steps"], band: "bg-tint-sage" },
    { href: centrePath(id, "inspections"), label: CENTRE_SECTION_TITLES.inspections, band: "bg-band" },
    { href: centrePath(id, "questions"), label: CENTRE_SECTION_TITLES.questions, band: "bg-tint-blue" },
  ];
}

export const CENTRE_SECTION_TITLES: Record<CentreSection, string> = {
  "look-first": "Issues found",
  inspections: "Inspection history",
  "next-steps": "How the home responded",
  questions: "What to ask",
};

export function centrePath(id: string, section?: CentreSection) {
  return section ? `/centres/${id}/${section}` : `/centres/${id}`;
}

// The tab's title: the home's name, after the subpage's when there is one.
// And its description, from the home's own facts (CCARE-289).
export async function centreMetadata(id: string, section?: CentreSection) {
  const lookup = await getCentre(id);
  if (lookup.status !== "found") {
    return { title: lookup.status === "not-found" ? "Nursing home not found" : "Nursing home page unavailable" };
  }
  const { centre } = lookup;
  // The page asks for the reports too, and one request shares the answer.
  const latest = (await getCentreReports(id))?.inspections.at(-1);
  return {
    title: section ? `${CENTRE_SECTION_TITLES[section]} · ${centre.centre_name}` : centre.centre_name,
    description: centreDescription(
      {
        name: centre.centre_name,
        where: townAndCounty(centre),
        residents: centre.maximum_occupancy,
        price: typeof centre.contract_price === "number" ? formatWeeklyPrice(centre.contract_price) : null,
        inspected: latest ? formatDate(latest.date) : null,
      },
      section,
    ),
  };
}
