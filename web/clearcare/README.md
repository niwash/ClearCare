This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Data

The site reads centres from the ClearCare API (`api/openapi.yaml`). Set these in `.env.local`, or in Vercel's environment variables:

- `API_URL`: the API's base URL. Production must set it.
Without `API_URL`, search and centre pages say the data isn't available.
- `GOOGLE_MAPS_BROWSER_KEY`: Google's browser key, for the place suggestions and the map on the search page. The server reads it for each request, so one built image serves every environment. Without it, the "Town, area or Eircode" box is a plain text box searched as an address or Eircode.
- `GOOGLE_MAPS_MAP_ID`: a map ID from the same Google Cloud project, for the map of the search results. Its pins are advanced markers, which Google draws only on a map with a map ID. `DEMO_MAP_ID` will do for local work.
- `SITE_TOKEN`: the token the site shares with the API (`.env.example`). The API gives the map's points only to a caller that sends it ([ADR-0029](../../docs/adr/0029-coordinates-reach-the-map-through-a-route-only-the-site-can-call.md)).

The search page offers its map only when `GOOGLE_MAPS_BROWSER_KEY`, `GOOGLE_MAPS_MAP_ID` and `SITE_TOKEN` are all set. Without any one of them it shows the list alone.

For local work, run the API with `docker compose up -d` from the repository root (see `CONTRIBUTING.md`) and set `API_URL=http://127.0.0.1:8080`.

### The map ID and its style

The map's pins, clusters, card and zoom buttons are the site's own (`components/search/`). The colours of the map under them belong to the map ID, as a style kept in Google Cloud, so they are set there and not in code. `map-style/light.json` and `map-style/dark.json` hold that style: a muted map in the site's colours, with shops, restaurants and other businesses hidden, and hospitals, pharmacies, places of worship, parks and transit kept. `DEMO_MAP_ID` can't take a style, so local work shows Google's own colours.

To set up a map ID, in the Google Cloud project that holds the browser key:

1. On [Maps Management](https://console.cloud.google.com/google/maps-apis/studio/maps), choose **Create map ID**. Name it, choose **JavaScript** as the map type, leave **Raster** selected, and save.
2. On [Map styles](https://console.cloud.google.com/google/maps-apis/studio/styles), choose **Create style**, open the **JSON** tab and upload `map-style/light.json`. Choose **Customize**, then **Save**, and name the style. Do the same with `map-style/dark.json`.
3. Back on the map ID, under **Map styles**, edit the light mode and choose the light style, edit the dark mode and choose the dark style, and save. A map ID holds one style for each, and the site asks for the one that matches its theme.
4. Set `GOOGLE_MAPS_MAP_ID` to the map ID. On AWS it is the `google_maps_map_id` variable in `infra/aws/live`.

To change the style later, edit it in the console, export its JSON and replace the file here, so the two stay the same. Google's steps are in [Use JSON with cloud-based maps styling](https://developers.google.com/maps/documentation/javascript/cloud-customization/json).
