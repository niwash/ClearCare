// app/centres/[id]/record.csv/route.ts
// The inspection history table as a CSV: one row per regulation, one column per inspection.
import { JUDGEMENT_LABELS } from "@/components/centre/judgement-icon";
import { formatDate, getCentre, getCentreReports } from "@/lib/centres";

function csvField(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(_request: Request, { params }: RouteContext<"/centres/[id]/record.csv">) {
  const { id } = await params;
  const centre = await getCentre(id);
  if (!centre) return new Response("Nursing home not found", { status: 404 });
  const reports = await getCentreReports(id);
  if (!reports) return new Response("No inspection reports for this home yet", { status: 404 });

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
  const csv = [header, ...rows].map((fields) => fields.map(csvField).join(",")).join("\r\n");
  const filename = `${centre.centre_id}-${centre.centre_name}`.replace(/[^A-Za-z0-9-]+/g, "-");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
