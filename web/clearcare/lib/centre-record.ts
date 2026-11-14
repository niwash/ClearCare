// lib/centre-record.ts
// Everything a centre's pages show (CCARE-212): the register entry, its inspection reports with the
// highlights and promise trails added from the findings (CCARE-207), what the home offers, and the
// events of its timeline (CCARE-235). The layout and each subpage ask for it; cache() loads it once
// per request, as getCentre and the others already are.
import { cache } from "react";
import {
  getCentre,
  getCentreAmenities,
  getCentreFindings,
  getCentreReports,
  getHiqaCheckedAt,
  type CentreAmenities,
  type CentreDetail,
  type CentreReports,
} from "@/lib/centres";
import { getCentreEvents, withoutUnpublished, type CentreEvent } from "@/lib/events";
import { addFindings } from "@/lib/findings";

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
    // Without the reports HIQA no longer publishes (CCARE-236), as getCentreReports leaves them out.
    events: events && withoutUnpublished(events, hiqaCheckedAt),
    hiqaCheckedAt,
    findingsRead: findings !== null,
    hasCompliancePlan: (findings ?? []).some(
      (finding) => finding.compliance_items.length > 0 || finding.provider_response !== null || Boolean(finding.stated_deadlines?.length),
    ),
  };
});

// The record's pages: the overview, and a subpage for each long section.
export type CentreSection = "look-first" | "inspections" | "next-steps" | "questions";

export const CENTRE_SECTION_TITLES: Record<CentreSection, string> = {
  "look-first": "What to look at first",
  inspections: "Inspection history",
  "next-steps": "What happened next",
  questions: "What to ask",
};

export function centrePath(id: string, section?: CentreSection) {
  return section ? `/centres/${id}/${section}` : `/centres/${id}`;
}

// The tab's title: the home's name, after the subpage's when there is one.
export async function centreMetadata(id: string, section?: CentreSection) {
  const lookup = await getCentre(id);
  if (lookup.status !== "found") {
    return { title: lookup.status === "not-found" ? "Nursing home not found" : "Nursing home record unavailable" };
  }
  return { title: section ? `${CENTRE_SECTION_TITLES[section]} · ${lookup.centre.centre_name}` : lookup.centre.centre_name };
}
