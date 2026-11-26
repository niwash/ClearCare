# County boundaries

One GeoJSON file for each county in `lib/counties.ts`, named as `countySlug` names the county (`lib/home-address.ts`). The search page's map draws the one for the county a search is filtered to (`components/search/county-outline.tsx`).

## Source

- Dataset: Tailte Éireann, "Counties - National Statutory Boundaries - 2019 - Generalised 20m".
- Page: <https://data-osi.opendata.arcgis.com/datasets/osi::counties-national-statutory-boundaries-2019-generalised-20m>
- Downloaded: 26 November 2026.
- Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit: © Tailte Éireann. The site gives the credit on its About page (`app/(site)/about/page.tsx`).

Tailte Éireann says the generalised boundaries are for reference only and may differ from the statutory ones. These files are simplified further, to about 200 metres, so close in the line can be that far from the true boundary.

## How the files were made

The dataset has each of the 26 counties as one feature, so nothing was merged. Islands smaller than 1 km² were left out: the four coastal counties in the west have thousands of them.

```sh
curl -o counties.geojson 'https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/arcgis/rest/services/Counties___OSi_National_Statutory_Boundaries___Generalised_20m/FeatureServer/0/query?where=1%3D1&outFields=COUNTY&outSR=4326&f=geojson'

npx mapshaper@0.8.12 counties.geojson \
  -simplify interval=200 \
  -filter-islands min-area=1km2 \
  -each 'slug = COUNTY.toLowerCase()' \
  -split slug \
  -filter-fields COUNTY \
  -o public/county-boundaries/ format=geojson rfc7946 precision=0.00001 extension=json
```

`outSR=4326` asks for WGS84. The counties are simplified together, before the split, so two neighbours keep the same line between them.

## The counties' boxes

`lib/county-boxes.ts` has the box each county's boundary fits in. On a wide screen the map's first view holds the whole county, and it takes that view before it has fetched the file. Each edge is rounded outwards to 3 decimals. `tests/county-boxes.test.ts` fails when the table no longer matches the files. To make the table again, run this in `web/clearcare` and paste the lines over the old ones:

```sh
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { COUNTIES } from "./lib/counties.ts";
import { countySlug } from "./lib/home-address.ts";
const up = (degrees) => Math.ceil(degrees * 1000) / 1000;
const down = (degrees) => Math.floor(degrees * 1000) / 1000;
for (const county of COUNTIES) {
  const { geometry } = JSON.parse(readFileSync(`public/county-boundaries/${countySlug(county)}.json`, "utf8")).features[0];
  const points = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates).flat(2);
  const lng = points.map((point) => point[0]);
  const lat = points.map((point) => point[1]);
  console.log(`  ${county}: { north: ${up(Math.max(...lat))}, south: ${down(Math.min(...lat))}, east: ${up(Math.max(...lng))}, west: ${down(Math.min(...lng))} },`);
}'
```
