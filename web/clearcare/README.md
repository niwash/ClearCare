This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Data

The site reads centres from the ClearCare API (`api/openapi.yaml`). Set these in `.env.local`, or in Vercel's environment variables:

- `API_URL`: the API's base URL. Production must set it.
Without `API_URL`, search and centre pages say the data isn't available.
- `GOOGLE_MAPS_BROWSER_KEY`: Google's browser key, for the place suggestions and the map on the search page. The server reads it for each request, so one built image serves every environment. Without it, the search box suggests nursing homes only, and a town or an area typed there is searched as a name.
- `GOOGLE_MAPS_MAP_ID`: a map ID from the same Google Cloud project, for the search page's map. Its pins are advanced markers, which Google draws only on a map with a map ID. `DEMO_MAP_ID` will do for local work.
- `SITE_TOKEN`: the token the site shares with the API (`.env.example`). The API gives the map's points only to a caller that sends it ([ADR-0029](../../docs/adr/0029-coordinates-reach-the-map-through-a-route-only-the-site-can-call.md)), and reads and changes the account's alerts for the same reason ([ADR-0034](../../docs/adr/0034-user-alerts-are-package-subscriptions.md)): without it the strips and the alerts page hide themselves.

The search page has a map only when `GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_MAPS_MAP_ID` and `SITE_TOKEN` are all set. Before anything is searched, it shows every home on the map under its prompt, so opening the page is enough to load Google's map. After a search, a screen 1280px wide or more shows the list with the map beside it, and the map loads there without anything being pressed. A narrower screen shows the list, with a switch to see the results on the map. Without any one of the three settings there is no map: the prompt alone before a search, and the list alone after one.

A search from a town measures from the town's landmark, whichever of Google's suggestions for the town was picked (CCARE-322): Google has them at different points. `lib/landmarks.ts` has the 115 towns of [`Research/City Landmarks`](../../Research/City%20Landmarks/README.md) with their landmarks, and the rule for which suggestion is one of them. The map's mark for the place stands on the landmark and names it, and the page says the distances are measured from it. Any other place is measured from Google's point for it.

On a search from a town's landmark, the map also draws the town's boundary as a line (CCARE-323), but only while the line reads as the town's shape: at least about 100 pixels on its longer side, and no larger than the map. Smaller, it is a smudge under the pins; larger, the view is inside it and only stray pieces show. So it comes and goes as the map is zoomed, and a search from Dublin City or from Kilrush opens without it. A county's line is not under this rule. The boundaries are files in `public/town-boundaries/`, one for each of the 113 towns the CSO has an area for, and `lib/town-boundaries.ts` names a town's file and has the rule. `public/town-boundaries/README.md` says where they come from and how to make them again.

When a search is filtered to a county, the map draws that county's boundary as a line (CCARE-319). The boundaries are files in `public/county-boundaries/`, one for each county, and `lib/county-boxes.ts` has the box each fits in, which a wide screen's first view holds. `public/county-boundaries/README.md` says where they come from and how to make both again.

For local work, run the API with `docker compose up -d` from the repository root (see `CONTRIBUTING.md`) and set `API_URL=http://127.0.0.1:8080`.

### The map ID and its style

The map's pins, clusters, card and zoom buttons are the site's own (`components/search/`). The colours of the map under them belong to the map ID, as a style kept in Google Cloud, so they are set there and not in code. `map-style/light.json` and `map-style/dark.json` hold that style: a muted map in the site's colours, with shops, restaurants and other businesses hidden, and hospitals, pharmacies, places of worship, parks and transit kept. `DEMO_MAP_ID` can't take a style, so local work shows Google's own colours.

To set up a map ID, in the Google Cloud project that holds the browser key:

1. On [Maps Management](https://console.cloud.google.com/google/maps-apis/studio/maps), choose **Create map ID**. Name it, choose **JavaScript** as the map type, leave **Raster** selected, and save.
2. On [Map styles](https://console.cloud.google.com/google/maps-apis/studio/styles), choose **Create style**, open the **JSON** tab and upload `map-style/light.json`. Choose **Customize**, then **Save**, and name the style. Do the same with `map-style/dark.json`.
3. Back on the map ID, under **Map styles**, edit the light mode and choose the light style, edit the dark mode and choose the dark style, and save. A map ID holds one style for each, and the site asks for the one that matches its theme.
4. Set `GOOGLE_MAPS_MAP_ID` to the map ID. On AWS it is the `google_maps_map_id` variable in `infra/aws/live`.

To change the style later, edit it in the console, export its JSON and replace the file here, so the two stay the same. Google's steps are in [Use JSON with cloud-based maps styling](https://developers.google.com/maps/documentation/javascript/cloud-customization/json).
