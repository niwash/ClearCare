// app/home-details/page.tsx
import { Section } from "@/components/section";
import Link from "next/link";

interface NursingHome {
  id: string;
  name: string;
  address: string;
  town: string;
  county: string;
  eircode: string;
  latestInspectionDate?: string;
}

type Judgement = "Compliant" | "Substantially compliant" | "Not compliant";

interface Inspection {
  id: string;
  date: string;
  type: "Announced" | "Unannounced";
  reportUrl: string;
}

interface RegulationJudgement {
  regulation: string;
  title: string;
  judgement: Judgement;
}

interface HomeDetails extends NursingHome {
  centreId: string;
  provider: string;
  personInCharge: string;
  registeredBeds: number;
  inspections: Inspection[];
  latestJudgements: RegulationJudgement[];
}

interface HomeDetailsPageProps {
  searchParams: Promise<{ id?: string }>;
}

// TODO: Replace with actual data
function getHomeDetails(id: string): HomeDetails {
  return {
    id,
    name: "Nursing home 1",
    address: "Random home street",
    town: "Ballina",
    county: "Mayo",
    eircode: "F26 X2P1",
    latestInspectionDate: "12 May 2025",
    centreId: "OSV-0000001",
    provider: "Example Care Ltd",
    personInCharge: "Jane Doe",
    registeredBeds: 48,
    inspections: [
      { id: "i3", date: "12 May 2025", type: "Unannounced", reportUrl: "#" },
      { id: "i2", date: "03 Oct 2024", type: "Announced", reportUrl: "#" },
      { id: "i1", date: "21 Feb 2024", type: "Unannounced", reportUrl: "#" },
    ],
    latestJudgements: [
      { regulation: "Regulation 5", title: "Individual assessment and care plan", judgement: "Compliant" },
      { regulation: "Regulation 9", title: "Residents' rights", judgement: "Substantially compliant" },
      { regulation: "Regulation 23", title: "Governance and management", judgement: "Not compliant" },
      { regulation: "Regulation 27", title: "Infection control", judgement: "Substantially compliant" },
      { regulation: "Regulation 28", title: "Fire precautions", judgement: "Compliant" },
    ],
  };
}

export async function generateMetadata({ searchParams }: HomeDetailsPageProps) {
  const { id } = await searchParams;
  return {
    title: id ? getHomeDetails(id).name : "Nursing home details",
  };
}

export default async function HomeDetailsPage({ searchParams }: HomeDetailsPageProps) {
  const { id } = await searchParams;

  if (!id) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-ink-muted">
        <p>
          No nursing home selected. <Link href="/search">Search for a nursing home</Link>.
        </p>
      </div>
    );
  }

  const home = getHomeDetails(id);
  const judgementCounts = countJudgements(home.latestJudgements);

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/search" className="hover:underline">
            Search
          </Link>
          <span>/</span>
          <span className="truncate">{home.name}</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr] md:gap-10">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">{home.name}</h1>
          <p className="text-ink-muted md:text-lg">
            {home.address}, {home.town}, Co. {home.county}
            {home.eircode && ` • ${home.eircode}`}
          </p>
          <p className="text-xs text-ink-muted md:text-sm">
            {home.inspections.length} HIQA {home.inspections.length === 1 ? "report" : "reports"} on file.
            {home.latestInspectionDate && ` Latest inspection on ${home.latestInspectionDate}.`}
          </p>
        </div>

        <aside className="rounded-lg border border-line bg-surface p-4 text-sm">
          <h2 className="font-semibold">Registration</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-ink-muted">Centre ID</dt>
            <dd className="font-mono">{home.centreId}</dd>
            <dt className="text-ink-muted">Provider</dt>
            <dd>{home.provider}</dd>
            <dt className="text-ink-muted">Person in charge</dt>
            <dd>{home.personInCharge}</dd>
            <dt className="text-ink-muted">Registered beds</dt>
            <dd>{home.registeredBeds}</dd>
          </dl>
        </aside>
      </div>

      <Section
        title="Latest compliance judgements"
        description={`From the inspection on ${home.inspections[0]?.date}. Each judgement is taken from the HIQA report.`}
      >
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
          {JUDGEMENTS.map((judgement) => (
            <li key={judgement}>
              <span className="font-semibold text-ink">{judgementCounts[judgement]}</span> {judgement.toLowerCase()}
            </li>
          ))}
        </ul>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Regulation</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Area</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Judgement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {home.latestJudgements.map((row) => (
                <tr key={row.regulation}>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted md:text-sm">
                    {row.regulation}
                  </td>
                  <td className="px-4 py-3">{row.title}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <JudgementLabel judgement={row.judgement} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Inspection reports" description="Every report HIQA has published for this centre, newest first.">
        <ol className="divide-y divide-line-soft rounded-lg border border-line bg-surface">
          {home.inspections.map((inspection) => (
            <li
              key={inspection.id}
              className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[7rem_8rem_1fr]"
            >
              <span className="font-mono text-xs text-ink-muted md:text-sm">{inspection.date}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted md:text-sm md:normal-case md:tracking-normal">
                {inspection.type}
              </span>
              <span className="col-span-2 md:col-span-1">
                <a href={inspection.reportUrl}>Read the HIQA report</a>
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

const JUDGEMENTS: Judgement[] = ["Compliant", "Substantially compliant", "Not compliant"];

function countJudgements(rows: RegulationJudgement[]) {
  const counts = Object.fromEntries(JUDGEMENTS.map((judgement) => [judgement, 0])) as Record<Judgement, number>;
  for (const row of rows) counts[row.judgement] += 1;
  return counts;
}

// Neutral styling only: the site reports HIQA's judgements, it doesn't rate homes.
function JudgementLabel({ judgement }: { judgement: Judgement }) {
  const marker = {
    Compliant: "bg-transparent",
    "Substantially compliant": "bg-ink-faint",
    "Not compliant": "bg-ink",
  }[judgement];

  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full border border-ink-muted ${marker}`} />
      {judgement}
    </span>
  );
}
