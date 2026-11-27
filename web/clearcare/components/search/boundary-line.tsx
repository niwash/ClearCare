"use client";

// components/search/boundary-line.tsx
// A place's boundary as a line on the results map: the county a search is filtered to (CCARE-319),
// and the town a search measures from (CCARE-323). In a user interview a visitor moved the map out
// of Dublin, saw no homes there and only then noticed the county filter: the county's line shows
// where the homes on the map stop. The town's line shows where the place searched from is (GitHub
// issue #236).
//
// The boundaries are the site's own files, one for each county and one for each town
// (public/county-boundaries/ and public/town-boundaries/, each with a README), and the browser
// fetches only the ones it draws. Google has boundaries of its own, but only on a vector map, and
// the map ID is a raster one (README).
import { useShownDesign } from "@/components/theme/design-toggle";
import { useShownTheme } from "@/components/theme/theme-toggle";
import type { MapBounds } from "@/lib/search-map";
import { useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

// The theme's primary colour, as it is shown now. Google draws its shapes outside the page's CSS,
// and the token read from the page is still "light-dark(…)", so an element in the page resolves it.
function primaryColour(within: HTMLElement) {
  const probe = document.createElement("span");
  probe.style.color = "var(--primary)";
  within.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

// When a line is to be seen, from the box it fits in, the map's zoom and the map's size in pixels.
type ShownWhile = (box: MapBounds, zoom: number, map: { width: number; height: number }) => boolean;

// The boundary in one of the site's files, by the file's address on the site. With shownWhile, the
// line is on the map only while that says so; without it, always.
export function BoundaryLine({ file, shownWhile }: { file: string; shownWhile?: ShownWhile }) {
  const map = useMap();
  // The line is drawn again when either changes, as its colour is read when it is drawn.
  const theme = useShownTheme();
  const design = useShownDesign();

  useEffect(() => {
    if (!map) return;
    // Not clickable: the pins, the card and the map's gestures get every press, as without the
    // line. Google draws its shapes under the pins. The theme's primary colour, as the pins have,
    // and no fill: a colour of its own would read as a warning, and a tinted place as a judgement
    // of it.
    const line = new google.maps.Data({
      map,
      style: { clickable: false, strokeColor: primaryColour(map.getDiv()), strokeWeight: 2, fillOpacity: 0 },
    });
    const left = new AbortController();

    // Asked each time the map comes to rest, not for every frame of a move: the line stays as it
    // is while the map is dragged or zoomed. Until the file is loaded there is no box to ask about.
    const box = new google.maps.LatLngBounds();
    const showOrHide = () => {
      const zoom = map.getZoom();
      const { clientWidth: width, clientHeight: height } = map.getDiv();
      const shown = shownWhile && zoom !== undefined && !box.isEmpty() && shownWhile(box.toJSON(), zoom, { width, height });
      line.setMap(shown ? map : null);
    };
    const atRest = shownWhile && map.addListener("idle", showOrHide);

    async function draw() {
      const response = await fetch(file, { signal: left.signal });
      if (!response.ok) return;
      const boundary = await response.json();
      // The search or the theme can change while the file is read, and this line is then left
      // behind (below): it must not be put back on the map.
      if (left.signal.aborted) return;
      line.addGeoJson(boundary);
      if (!shownWhile) return;
      line.forEach((feature) => feature.getGeometry()?.forEachLatLng((point) => box.extend(point)));
      showOrHide();
    }
    // Without the file the map is as it is for a search with no boundary, and says nothing: the line
    // helps to read the map, and the homes on it are right without it.
    draw().catch(() => {});

    return () => {
      left.abort();
      atRest?.remove();
      line.setMap(null);
    };
  }, [map, file, shownWhile, theme, design]);

  return null;
}
