// lib/county-boxes.ts
// The box each county's boundary fits in (CCARE-319). On a wide screen the map's first view holds
// it (components/search/results-map.tsx). The map takes that view when it is made, before the county's
// boundary file is fetched (components/search/boundary-line.tsx), so the box must be known without
// the file. Made from the files in public/county-boundaries/, whose README has the command;
// tests/county-boxes.test.ts fails when a file changes and this table doesn't.
import type { MapBounds } from "./search-map.ts";

// By the county as the API spells it (lib/counties.ts). In degrees, to 3 decimals, each edge rounded
// outwards so the box holds the whole line.
const COUNTY_BOXES: Record<string, MapBounds> = {
  Carlow: { north: 52.918, south: 52.463, east: -6.504, west: -7.108 },
  Cavan: { north: 54.305, south: 53.765, east: -6.762, west: -8.059 },
  Clare: { north: 53.169, south: 52.556, east: -8.282, west: -9.936 },
  Cork: { north: 52.388, south: 51.421, east: -7.842, west: -10.232 },
  Donegal: { north: 55.383, south: 54.459, east: -6.922, west: -8.805 },
  Dublin: { north: 53.635, south: 53.178, east: -6.006, west: -6.547 },
  Galway: { north: 53.719, south: 52.968, east: -7.967, west: -10.303 },
  Kerry: { north: 52.603, south: 51.688, east: -9.118, west: -10.59 },
  Kildare: { north: 53.452, south: 52.857, east: -6.459, west: -7.169 },
  Kilkenny: { north: 52.894, south: 52.243, east: -6.915, west: -7.675 },
  Laois: { north: 53.214, south: 52.781, east: -6.931, west: -7.735 },
  Leitrim: { north: 54.475, south: 53.805, east: -7.585, west: -8.428 },
  Limerick: { north: 52.758, south: 52.28, east: -8.159, west: -9.368 },
  Longford: { north: 53.942, south: 53.521, east: -7.377, west: -8.036 },
  Louth: { north: 54.114, south: 53.698, east: -6.103, west: -6.696 },
  Mayo: { north: 54.343, south: 53.471, east: -8.582, west: -10.236 },
  Meath: { north: 53.918, south: 53.381, east: -6.213, west: -7.344 },
  Monaghan: { north: 54.422, south: 53.9, east: -6.549, west: -7.34 },
  Offaly: { north: 53.425, south: 52.848, east: -6.977, west: -8.084 },
  Roscommon: { north: 54.125, south: 53.271, east: -7.875, west: -8.824 },
  Sligo: { north: 54.474, south: 53.913, east: -8.155, west: -9.137 },
  Tipperary: { north: 53.168, south: 52.202, east: -7.372, west: -8.481 },
  Waterford: { north: 52.364, south: 51.938, east: -6.951, west: -8.163 },
  Westmeath: { north: 53.8, south: 53.318, east: -6.956, west: -7.973 },
  Wexford: { north: 52.798, south: 52.124, east: -6.14, west: -7.019 },
  Wicklow: { north: 53.235, south: 52.682, east: -5.999, west: -6.793 },
};

// A county's box, or null for no county or one the site doesn't know.
export function countyBox(county: string): MapBounds | null {
  return Object.hasOwn(COUNTY_BOXES, county) ? COUNTY_BOXES[county] : null;
}
