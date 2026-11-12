// app/(site)/search/names/route.ts
// The names of the homes that match what is typed in the search box (SearchBox): its suggestions,
// and whether any home's name matches, which Search asks before it takes the text for a place
// (settleBox, lib/search-box.ts). Asked of the API here, as the counts are (../count/route.ts).
import { searchCentres } from "@/lib/search";

// As many homes as the box suggests.
const NAMES_OFFERED = "5";

export async function GET(request: Request) {
  const text = new URL(request.url).searchParams.get("text")?.trim() ?? "";
  // The API takes an empty name as no name, and would answer with every home.
  if (!text) return Response.json({ detail: "text: expected the words typed in the search box." }, { status: 400 });
  const result = await searchCentres({ name: text, page: "1", page_size: NAMES_OFFERED });
  if (!result.ok) return Response.json({ detail: result.detail }, { status: result.status || 502 });
  // Homes that share a name are one suggestion: picking it searches for the name.
  return Response.json({ names: [...new Set(result.data.centres.map((centre) => centre.centre_name))] });
}
