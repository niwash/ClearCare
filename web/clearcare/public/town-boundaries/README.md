# Town boundaries

One GeoJSON file for each town on the landmark list (`Research/City Landmarks/`) that the CSO has an area for: 113 of the list's 115 places. `townBoundaryFile` names a town's file (`lib/town-boundaries.ts`): the town's name on the list without a bracketed part, so "Dublin City" is `dublin-city.json` and "Dingle (Daingean Uí Chúis)" is `dingle.json`. The search page's map draws the one for the town a search measures from, when the search is from the town's landmark (`lib/landmarks.ts`, `components/search/boundary-line.tsx`), and only while the line reads as the town's shape on the map: neither too small to see nor larger than the map (`townLineReads` in `lib/town-boundaries.ts`).

## Source

- Dataset: CSO, "Census 2022 - Table 1.2 - Population by sex and marital status by Built Up Urban Areas", the map layer `CensusHub2022_T1_2_BUA`. `Research/City Landmarks/check_rules.py` reads the same layer for where each town is.
- Page: <https://censushub-ie-cso.hub.arcgis.com/datasets/IE-CSO::census-2022-table-1-2-population-by-sex-and-marital-status-by-built-up-urban-areas>, on the CSO's Census Hub.
- Downloaded: 27 November 2026.
- Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit: © CSO/Tailte Éireann, which is the layer's own credit line. The site gives the credit on its About page (`app/(site)/about/page.tsx`).

A Built Up Area is the town as the census counts it: the built-up land, with its suburbs. It is not a council's boundary, so the line follows the edge of the houses and can be ragged. The CSO draws the areas from Tailte Éireann's boundaries generalised to 20 metres. These files are simplified further, to about 40 metres, and a spike with no width, such as a harbour wall, is cut off, so close in the line can be some way from the CSO's.

## Two places have no file

Dún Laoghaire and Tallaght are council seats inside the Dublin city and suburbs area, so the CSO has no area of their own for them. `dublin-city.json` is the whole of that area and holds both. A search from either draws no line, and `townBoundaryFile` gives no file for them, so the map asks for none.

## How the files were made

The layer has no county and names ten of the towns differently from the list ("Dublin city and suburbs", "Greystones-Delgany", "Donegal"), so a town is paired with its area by its Census 2022 population, as `check_rules.py` pairs them. The list has the figure in `how-places-were-chosen.md` and the layer has it as `T1_2T`. Each of the 113 figures belongs to one area only, and mapshaper must report `113/867 targets matched`.

Run in a temporary folder, with `$WEB` set to the path of `web/clearcare`:

```sh
curl -o built-up-areas.geojson 'https://services-eu1.arcgis.com/BuS9rtTsYEV5C0xh/arcgis/rest/services/CensusHub2022_T1_2_BUA/FeatureServer/0/query?where=1%3D1&outFields=BUA_NAME,T1_2T&outSR=4326&f=geojson'

(cd "$WEB" && node --input-type=module -e '
import { readFileSync } from "node:fs";
import { addressWords } from "./lib/home-address.ts";
const list = readFileSync("../../Research/City Landmarks/how-places-were-chosen.md", "utf8");
console.log("slug,population");
for (const [, place, population] of list.matchAll(/^\| [A-Z][a-z]+ +\| ([^|]+?) +\| [^|]+\| ([0-9,]+) +\|/gm)) {
  console.log(`${addressWords(place.replace(/ \(.*\)$/, ""))},${population.replaceAll(",", "")}`);
}') > towns.csv

npx mapshaper@0.8.12 built-up-areas.geojson \
  -join towns.csv keys=T1_2T,population \
  -filter 'slug != null' \
  -simplify interval=40 \
  -explode \
  -filter 'this.area >= 100000' \
  -dissolve slug copy-fields=BUA_NAME \
  -split slug \
  -filter-fields BUA_NAME \
  -o "$WEB/public/town-boundaries/" format=geojson rfc7946 precision=0.00001 extension=json
```

`outSR=4326` asks for WGS84. `towns.csv` has a line for each town: its file's name and its population. The two places without an area have no figure on the list, so they have no line.

`-explode`, the `-filter` after it and `-dissolve` leave out the parts of a town smaller than 10 hectares (100,000 m²), which at the map's zoom are specks beside the town. After that only Wexford has more than one part. The areas have no holes. Each file keeps the CSO's name for its area as `BUA_NAME`.
