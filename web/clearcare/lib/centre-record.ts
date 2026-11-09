// lib/centre-record.ts
// Everything a centre's pages show (CCARE-212): the register entry, its inspection reports with the
// highlights and promise trails added from the findings (CCARE-207), and what the home offers. The
// layout and each subpage ask for it; cache() loads it once per request, as getCentre and the
// others already are.
import { cache } from "react";
import {
  getCentre,
  getCentreAmenities,
  getCentreFindings,
  getCentreReports,
  type CentreAmenities,
  type CentreDetail,
  type CentreReports,
} from "@/lib/centres";
import { addFindings } from "@/lib/findings";

export type CentreRecord =
  | { status: "not-found" }
  | { status: "unavailable"; httpStatus: number }
  | {
      status: "found";
      centre: CentreDetail;
      reports: CentreReports | null;
      amenities: CentreAmenities | null;
      // false when the findings couldn't be read, so the pages built from them don't say nothing
      // stands out when they simply don't know.
      findingsRead: boolean;
    };

export const getCentreRecord = cache(async (id: string): Promise<CentreRecord> => {
  const lookup = await getCentre(id);
  if (lookup.status === "not-found") return { status: "not-found" };
  if (lookup.status === "unavailable") return { status: "unavailable", httpStatus: lookup.httpStatus };
  const [baseReports, amenities, findings] = await Promise.all([
    getCentreReports(id),
    getCentreAmenities(id),
    getCentreFindings(id),
  ]);
  // Without findings the reports have no highlights or trails, and the pages show the history alone.
  return {
    status: "found",
    centre: lookup.centre,
    reports: baseReports && addFindings(baseReports, findings),
    amenities,
    findingsRead: findings !== null,
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
