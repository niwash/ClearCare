// app/(site)/centres/[...path]/route.ts
// A home's address before CCARE-297, /centres/<id> and its tabs, sent on for good to the one it has
// now (/nursing-homes/<county>/<name>-<id>, lib/home-address.ts), keeping any query, such as a
// guide's way back. Old links, bookmarks, search engines' copies, alert emails and the shortlist's
// links (which know a home's name but not its county) all still arrive. The county and name come
// from the register, so a home that can't be read gets the same answer its page would.
import { getCentre } from "@/lib/centres";
import { homePath, sectionFrom } from "@/lib/home-address";
import { unavailableMessage } from "@/lib/search";

export async function GET(request: Request, { params }: RouteContext<"/centres/[...path]">) {
  const [id, end, ...rest] = (await params).path;
  // record.csv is the spreadsheet, under the home's own address like its tabs.
  const section = end === undefined || end === "record.csv" ? null : sectionFrom(end);
  if (!/^\d{1,8}$/.test(id) || rest.length > 0 || (end !== undefined && end !== "record.csv" && !section)) {
    return new Response("Page not found", { status: 404 });
  }
  const lookup = await getCentre(id);
  if (lookup.status === "not-found") return new Response("Nursing home not found", { status: 404 });
  if (lookup.status === "unavailable") return new Response(unavailableMessage(lookup.httpStatus), { status: 503 });
  const path = end === "record.csv" ? `${homePath(lookup.centre)}/record.csv` : homePath(lookup.centre, section ?? undefined);
  const { search } = new URL(request.url);
  return new Response(null, { status: 308, headers: { Location: `${path}${search}` } });
}
