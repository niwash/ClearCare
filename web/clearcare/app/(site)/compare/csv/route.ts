// app/(site)/compare/csv/route.ts
// Compare Homes as a spreadsheet (CCARE-189), for Download as CSV: the homes in ?homes= laid out as
// the grid is, a row per detail and a column per home, so a family can keep it, print it or add
// notes of their own. Every regulation is there, not only where a home fell short, and the sources
// close it, as the CC BY licence asks.
import { JUDGEMENT_LABELS } from "@/components/centre/judgement-icon";
import {
  centrePhone,
  formatDate,
  formatMonth,
  getCentre,
  getCentreAmenities,
  getCentreReports,
  HOME_TYPE_LABELS,
  type CentreAmenities,
  type CentreDetail,
  type CentreReports,
  type Regulation,
} from "@/lib/centres";
import { latestJudged, notCompliantAtLatest, parseHomesParam, regulationRows, repeatedNotCompliant } from "@/lib/compare";
import { toCsv } from "@/lib/csv";
import { originFrom } from "@/lib/request-origin";
import { formatEircode } from "@/lib/search";

type Home = { centre: CentreDetail; reports: CentreReports | null; amenities: CentreAmenities | null };

async function loadHome(id: string): Promise<Home | null> {
  const lookup = await getCentre(id);
  if (lookup.status !== "found") return null;
  const [reports, amenities] = await Promise.all([getCentreReports(id), getCentreAmenities(id)]);
  return { centre: lookup.centre, reports, amenities };
}

const AMENITY_LISTS = [
  ["care_types", "Types of care"],
  ["room_types", "Rooms"],
  ["activities", "Activities"],
  ["facilities", "Facilities"],
] as const;

const regulationList = (regulations: Regulation[]) =>
  regulations.length === 0 ? "None" : regulations.map((regulation) => `Reg. ${regulation.number} ${regulation.title}`).join("; ");

export async function GET(request: Request) {
  const ids = parseHomesParam(new URL(request.url).searchParams.get("homes") ?? undefined);
  // A home off the register, or that couldn't be loaded just now, is left out.
  const homes = (await Promise.all(ids.map(loadHome))).filter((home): home is Home => home !== null);
  if (homes.length === 0) return new Response("None of these homes could be loaded.", { status: 404 });

  const row = (label: string, cell: (home: Home) => string) => [label, ...homes.map(cell)];
  const reported = (cell: (reports: CentreReports) => string) => (home: Home) =>
    home.reports ? cell(home.reports) : "No reports in ClearCare yet";
  const judged = (cell: (reports: CentreReports) => string) =>
    reported((reports) => (latestJudged(reports) ? cell(reports) : "No inspection in ClearCare checked regulations"));

  const regulations = regulationRows(homes.map((home) => home.reports));
  // The address the browser used, not the container's own (see request-origin.ts).
  const origin = originFrom({
    "x-forwarded-host": request.headers.get("x-forwarded-host"),
    "x-forwarded-proto": request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host"),
  });

  const rows = [
    row("", (home) => home.centre.centre_name),
    row("County", (home) => home.centre.county),
    [],
    ["Cost"],
    // A plain number, so a spreadsheet can sort and sum it.
    row("Full weekly cost (€, HSE Fair Deal price)", (home) =>
      typeof home.centre.contract_price === "number" ? String(home.centre.contract_price) : "Not available",
    ),
    row("Type of home", (home) => (home.centre.home_type ? HOME_TYPE_LABELS[home.centre.home_type] : "Not stated")),
    [],
    ["The home"],
    row("Registered for (residents)", (home) =>
      home.centre.maximum_occupancy !== null ? String(home.centre.maximum_occupancy) : "Not stated",
    ),
    row("Address", (home) => home.centre.address),
    row("Eircode", (home) => (home.centre.eircode ? formatEircode(home.centre.eircode) : "Not stated")),
    row("Phone", (home) => centrePhone(home.centre.centre_phone)?.text ?? "Not listed"),
    row("HIQA centre ID", (home) => home.centre.centre_id),
    [],
    ["What the home offers (read by an AI tool from each home's inspection report; call the home to confirm)"],
    ...AMENITY_LISTS.map(([key, label]) =>
      row(label, ({ amenities }) =>
        !amenities
          ? "Not read from its reports yet"
          : amenities[key].length === 0
            ? "None found in the report"
            : amenities[key].map(({ item }) => item).join("; "),
      ),
    ),
    row("Report date", ({ amenities }) =>
      !amenities ? "" : amenities.inspection_date ? formatDate(amenities.inspection_date) : "Not stated",
    ),
    [],
    ["Inspections"],
    row("Latest inspection report", reported(({ inspections }) => formatDate(inspections.at(-1)!.date))),
    row("Reports in ClearCare", reported(({ inspections }) => String(inspections.length))),
    row("Not compliant at the latest inspection", judged((reports) => regulationList(notCompliantAtLatest(reports)))),
    row("Not compliant at 2 inspections in a row", judged((reports) => regulationList(repeatedNotCompliant(reports)))),
    [],
    ["Results by regulation (each home's latest judgment, and when)"],
    ...regulations.map(({ regulation, results }) =>
      row(`Reg. ${regulation.number} ${regulation.title}`, (home) => {
        const result = results[homes.indexOf(home)];
        if (!home.reports) return "No reports in ClearCare yet";
        return result ? `${JUDGEMENT_LABELS[result.judgement]} (${formatMonth(result.date)})` : JUDGEMENT_LABELS["not-assessed"];
      }),
    ),
    [],
    row("Full record on ClearCare", (home) => `${origin}/centres/${home.centre.centre_id}`),
    row("On the HIQA website", (home) => home.centre.hiqa_url),
    [],
    ["ClearCare does not rate or recommend homes."],
    [
      "Uses HIQA inspection reports and register data under the Irish PSI licence (CC BY 4.0), and the HSE's Fair Deal price lists.",
    ],
    [`Downloaded ${formatDate(new Date().toISOString().slice(0, 10))}`],
  ];

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clearcare-compare-homes.csv"',
      // The homes' details change as HIQA publishes, so it's made fresh each time.
      "Cache-Control": "no-store",
    },
  });
}
