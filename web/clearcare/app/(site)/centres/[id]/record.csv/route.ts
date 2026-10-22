// app/centres/[id]/record.csv/route.ts
// The home's details, a blank row, then the inspection history table as a CSV:
// one row per regulation, one column per inspection.
import { JUDGEMENT_LABELS } from "@/components/centre/judgement-icon";
import { centrePhone, formatDate, formatWeeklyPrice, getCentre, getCentreReports, HOME_TYPE_LABELS } from "@/lib/centres";
import { toCsv } from "@/lib/csv";
import { formatEircode, unavailableMessage } from "@/lib/search";

export async function GET(_request: Request, { params }: RouteContext<"/centres/[id]/record.csv">) {
  const { id } = await params;
  const lookup = await getCentre(id);
  if (lookup.status === "not-found") return new Response("Nursing home not found", { status: 404 });
  if (lookup.status === "unavailable") return new Response(unavailableMessage(lookup.httpStatus), { status: 503 });
  const { centre } = lookup;
  const reports = await getCentreReports(id);
  if (!reports) return new Response("No inspection reports for this home yet", { status: 404 });

  const phone = centrePhone(centre.centre_phone);
  const details = [
    ["Nursing home", centre.centre_name],
    ["Address", centre.address],
    ["County", `Co. ${centre.county}`],
    ["Eircode", centre.eircode ? formatEircode(centre.eircode) : "Not stated"],
    ...(phone ? [["Phone", phone.text]] : []),
    ["HIQA centre ID", centre.centre_id],
    [
      "Registered for",
      centre.maximum_occupancy !== null
        ? `Up to ${centre.maximum_occupancy} residents (the most HIQA allows, not free beds)`
        : "Not stated",
    ],
    // As on the page: no rows from an API without prices.
    ...(centre.home_type ? [["Type of home", HOME_TYPE_LABELS[centre.home_type]]] : []),
    ...(centre.contract_price !== undefined
      ? [
          [
            "Full weekly cost",
            centre.contract_price !== null
              ? `${formatWeeklyPrice(centre.contract_price)} per week (not including extra charges)`
              : "Not available",
          ],
        ]
      : []),
    ["HIQA page", centre.hiqa_url],
    ["Downloaded", formatDate(new Date().toISOString())],
  ];

  const inspections = reports.inspections.filter((inspection) => inspection.regulationJudgements);
  const header = [
    "Regulation",
    "Title",
    ...inspections.map((inspection) => `${formatDate(inspection.date)} (${inspection.type})`),
  ];
  const rows = reports.history.map((row) => [
    row.regulation.number,
    row.regulation.title,
    ...inspections.map((inspection) => JUDGEMENT_LABELS[row.results[inspection.id] ?? "not-assessed"]),
  ]);
  const csv = toCsv([...details, [], header, ...rows]);
  const filename = `${centre.centre_id}-${centre.centre_name}`.replace(/[^A-Za-z0-9-]+/g, "-");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
