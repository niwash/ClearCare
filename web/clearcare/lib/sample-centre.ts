// lib/sample-centre.ts
// The start page's example: a home picked at random on every load, with what its latest
// inspection found. Built from the same data as the centre page (getCentre, getCentreReports).
import {
  changeFrom,
  getCentre,
  getCentreReports,
  SEVERITY,
  type CentreDetail,
  type Change,
  type Inspection,
  type Judgement,
  type Regulation,
} from "./centres";
import { searchCentres } from "./search";

// Homes tried before giving up, in case the first picks have no reports loaded yet.
const ATTEMPTS = 5;

type Judged = Exclude<Judgement, "not-assessed">;

export interface SampleFinding {
  regulation: Regulation;
  judgement: Judged;
  // Compared with the last inspection before this one that assessed the regulation.
  change?: Change;
}

export interface SampleCentre {
  centre: CentreDetail;
  latest: Inspection;
  reportCount: number;
  firstYear: number;
  counts: Record<Judged, number>;
  findings: SampleFinding[]; // not fully compliant at the latest inspection, worst first
}

export async function getSampleCentre(total: number | null): Promise<SampleCentre | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const id = await randomCentreId(total);
    if (!id) return null;
    const sample = await summarise(id);
    if (sample) return sample;
  }
  return null;
}

async function randomCentreId(total: number | null): Promise<string | null> {
  if (!total) return null;
  const page = 1 + Math.floor(Math.random() * total);
  const result = await searchCentres({ page: String(page), page_size: "1" });
  return result.ok ? (result.data.centres[0]?.centre_id ?? null) : null;
}

async function summarise(id: string): Promise<SampleCentre | null> {
  const [lookup, reports] = await Promise.all([getCentre(id), getCentreReports(id)]);
  if (lookup.status !== "found" || !reports) return null;
  const judged = reports.inspections.filter((inspection) => inspection.regulationJudgements);
  const latest = judged.at(-1);
  if (!latest) return null;
  const earlier = judged.slice(0, -1).reverse(); // most recent first

  const counts: Record<Judged, number> = { compliant: 0, "substantially-compliant": 0, "not-compliant": 0 };
  const findings: SampleFinding[] = [];
  for (const row of reports.history) {
    const judgement = row.results[latest.id];
    if (!judgement) continue;
    counts[judgement]++;
    if (judgement === "compliant") continue;

    const before = earlier.map((inspection) => row.results[inspection.id]).find(Boolean);
    findings.push({ regulation: row.regulation, judgement, change: before && changeFrom(before, judgement) });
  }
  findings.sort((a, b) => SEVERITY[b.judgement] - SEVERITY[a.judgement] || a.regulation.number - b.regulation.number);

  return {
    centre: lookup.centre,
    latest,
    reportCount: reports.inspections.length,
    firstYear: new Date(reports.inspections[0].date).getUTCFullYear(),
    counts,
    findings,
  };
}
