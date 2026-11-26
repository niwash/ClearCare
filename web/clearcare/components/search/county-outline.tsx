"use client";

// components/search/county-outline.tsx
// The boundary of the county a search is filtered to, as a line on the results map (CCARE-319). In
// a user interview a visitor moved the map out of Dublin, saw no homes there and only then noticed
// the county filter: the line shows where the homes on the map stop.
//
// The boundaries are the site's own files, one for each county (public/county-boundaries/, with a
// README), and the browser fetches only the one it draws. Google has boundaries of its own, but only
// on a vector map, and the map ID is a raster one (README).
import { useShownDesign } from "@/components/theme/design-toggle";
import { useShownTheme } from "@/components/theme/theme-toggle";
import { countySlug } from "@/lib/home-address";
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

export function CountyOutline({ county }: { county: string }) {
  const map = useMap();
  // The line is drawn again when either changes, as its colour is read when it is drawn.
  const theme = useShownTheme();
  const design = useShownDesign();

  useEffect(() => {
    if (!map) return;
    // Not clickable: the pins, the card and the map's gestures get every press, as without the
    // line. Google draws its shapes under the pins. The theme's primary colour, as the pins have,
    // and no fill: a colour of its own would read as a warning, and a tinted county as a judgement
    // of it.
    const line = new google.maps.Data({
      map,
      style: { clickable: false, strokeColor: primaryColour(map.getDiv()), strokeWeight: 2, fillOpacity: 0 },
    });
    const left = new AbortController();

    async function draw() {
      const response = await fetch(`/county-boundaries/${countySlug(county)}.json`, { signal: left.signal });
      if (response.ok) line.addGeoJson(await response.json());
    }
    // Without the file the map is as it is for a search with no county, and says nothing: the line
    // helps to read the map, and the homes on it are right without it.
    draw().catch(() => {});

    return () => {
      left.abort();
      line.setMap(null);
    };
  }, [map, county, theme, design]);

  return null;
}
