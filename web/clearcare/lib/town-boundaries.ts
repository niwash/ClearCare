// lib/town-boundaries.ts
// Where a town's boundary file is (public/town-boundaries/, with a README; CCARE-323), and when its
// line is drawn. The search page's map draws it for a search from the town's landmark
// (lib/landmarks.ts), while it reads as the town's shape.
// The tests load this file as it is, so its imports are named with their extensions.
import { addressWords } from "./home-address.ts";
import type { MapBounds } from "./search-map.ts";

// Council seats inside the CSO's Dublin city and suburbs area, which has no area of their own for
// them. They get no line: Dublin's holds both, and is 29 km across.
const WITHOUT_AN_AREA = ["Dún Laoghaire", "Tallaght"];

// The address on the site of a town's boundary file, or null for a town without one. The town is
// named as the landmarks name it, and its file by that name without a bracketed part: "Dingle
// (Daingean Uí Chúis)" is dingle.json. tests/town-boundaries.test.ts holds the names and the files
// together.
export function townBoundaryFile(town: string): string | null {
  if (WITHOUT_AN_AREA.includes(town)) return null;
  return `/town-boundaries/${addressWords(town.replace(/ \(.*\)$/, ""))}.json`;
}

// A town's line is drawn only while it reads as the town's shape (below). Both numbers are a
// judgement, from twelve towns' searches looked at on the map on 27 November 2026.
// The least its longer side takes on the screen, in pixels. The landmark's mark and its name under
// it take about 80 pixels down the middle of the town, and a cluster of its homes 45. Kilrush's
// search opens with the town 25 pixels across, a smudge under them, and at 100 most of its line is
// still under them. Navan's opens at 123, and reads.
const SMALLEST_PX = 100;
// The most its longer side takes, in the map's longer sides. Larger than the map, the view is
// inside the line: Navan's at 1.2 times the map shows nothing, and Dublin City's at 1.6 times
// shows only stray pieces over the water round the port.
const LARGEST_IN_MAPS = 1;

// Whether a town's line reads as the town's shape on a map at this zoom: neither too small to see
// nor so large that the view is inside it. box is the box the line fits in, and map the map's size
// in pixels. A county's line is not under this rule (components/search/results-map.tsx).
export function townLineReads(box: MapBounds, zoom: number, map: { width: number; height: number }): boolean {
  // Google's map is the Web Mercator one: the world is a square of 256 pixels at zoom 0 and doubles
  // with each zoom, and a latitude's place down it is this share of the square.
  const world = 256 * 2 ** zoom;
  const down = (latitude: number) => Math.asinh(Math.tan((latitude * Math.PI) / 180)) / (2 * Math.PI);
  const longerSide = Math.max(((box.east - box.west) / 360) * world, (down(box.north) - down(box.south)) * world);
  return longerSide >= SMALLEST_PX && longerSide <= LARGEST_IN_MAPS * Math.max(map.width, map.height);
}
