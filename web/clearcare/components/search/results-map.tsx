"use client";

// components/search/results-map.tsx
// The search results on a Google map (CCARE-229): a pin for every home the search matches, clusters
// where pins would pile up, and a card for the home that is chosen. On a wide screen it is beside the
// list of the same results (CCARE-230, list-beside-map.tsx). Before anything is searched, the
// page draws the same map with every home on it, under its prompt or, on a wide screen, beside the
// ways to start. The points come from the page, which read them on the server (ADR-0029); nothing
// here asks for more as the map moves. It is drawn inside the page's one Google loader
// (GoogleMapsLoader, google-places.tsx).
//
// Only the map itself is Google's. The pins and clusters (map-pins.tsx), the card (map-card.tsx) and
// the zoom buttons are the site's, and the map's colours come with its map ID (map-style/, README).
import { useShownTheme } from "@/components/theme/theme-toggle";
import { Icon } from "@/components/ui/icons";
import { clusterIndex, markOf, marksIn, opensAt, type Cluster } from "@/lib/map-clusters";
import { firstView, nearPoint, shiftInto, type Box, type CentrePoint, type LatLng, type MapBounds } from "@/lib/search-map";
import { APILoadingStatus, AdvancedMarker, ColorScheme, ControlPosition, Map, MapControl, useApiLoadingStatus, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";

import { useListBesideMap } from "./list-beside-map";
import { HomeCard } from "./map-card";
import { ClusterPin, HomePin, PlacePin } from "./map-pins";
import { MapUnavailable } from "./view-switch";

// The space kept between the map's edges and what a first view or a card shows.
const EDGE = 48;
// How far a card's foot stands above its home's point, in pixels: over the chosen pin, with room for
// the card's pointer.
const CARD_LIFT = 34;
// What a chosen pin's name takes under it.
const NAME_HEIGHT = 28;
// The strip at the map's right edge that the zoom buttons stand in. A card is kept out of it: its
// close button would be under them.
const BUTTONS = 80;
// The card's width in rem: Tailwind's w-72.
const CARD_WIDTH = 18;
// From Tailwind's md up, the page has the filters beside the results, and the card can stand over
// its pin. Below it, the card is docked at the map's foot: on a phone it would leave little map.
const WIDE = "(min-width: 48rem)";

// Whether the card can stand over its pin: from md up, and only if the map is as wide as the card
// and the zoom buttons' strip. The breakpoint alone is not enough. "Easier to read" enlarges the
// card and the filters beside the map but not the breakpoint, so at a tablet's width the map is
// narrower than the card needs, and the card is docked there too.
function roomForCard(map: google.maps.Map | null) {
  if (!map || !matchMedia(WIDE).matches) return false;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return map.getDiv().clientWidth >= CARD_WIDTH * rem + EDGE / 2 + BUTTONS;
}

function subscribeResize(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => window.removeEventListener("resize", listener);
}

export function ResultsMap({
  points,
  near,
  place,
  mapId,
  listHref,
}: {
  points: CentrePoint[];
  near: string; // where the search measures from, or ""
  place: string; // its name, or "" for a location with none
  mapId: string; // advanced markers need one (README)
  listHref?: string; // the same homes as a list; none before a search, which has no list
}) {
  // null until the page's theme is known: Google's map takes its colours when it is made.
  const theme = useShownTheme();
  const [drawn, setDrawn] = useState(false);
  // The home whose pin was pressed, which the list beside the map marks too, and the home whose
  // card is pointed at there, which the map marks.
  const { chosenId, choose, pointedId } = useListBesideMap();
  // A new search draws a new map, and the home chosen on this one goes with it.
  useEffect(() => () => choose(null), [choose]);
  // The pin the card was opened from, which gets the keyboard's focus back when the card is closed.
  const opener = useRef<HTMLElement | null>(null);

  // Maps JavaScript didn't load, as when a browser blocks it, or Google refused the key, as it does
  // on an address the key isn't limited to. Google reports a refusal by calling this global, and
  // would otherwise draw its own error box where the map goes.
  const failed = useApiLoadingStatus() === APILoadingStatus.FAILED;
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    const page = window as Window & { gm_authFailure?: () => void };
    page.gm_authFailure = () => setRefused(true);
    return () => {
      delete page.gm_authFailure;
    };
  }, []);

  if (failed || refused) return <MapUnavailable listHref={listHref} listBeside />;

  function close() {
    choose(null);
    opener.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <p className="sr-only">
        {listHref ? (
          <>
            The map shows the same nursing homes as the list.
            {/* Only where the switch is: a wide screen has the list beside the map. */}
            <span className="xl:hidden"> To read them without the map, choose List above.</span>
          </>
        ) : (
          "The map shows nursing homes across Ireland. To read them as a list, search for a name, a place or a county."
        )}
      </p>
      {/* The frame of a result card. Until Google's first tiles are drawn it says so, and the map
          then fades in over it, rather than a grey box turning into a map. On a wide screen it is
          beside the list, or the ways to start, and fills the place the page keeps for it, which
          has the window's height. */}
      <div
        role="region"
        aria-label={listHref ? "Map of the nursing homes found" : "Map of nursing homes across Ireland"}
        onKeyDown={(event) => {
          if (event.key === "Escape" && chosenId) close();
        }}
        className="relative isolate h-[70dvh] overflow-hidden rounded-2xl border border-line bg-surface-muted md:h-[44rem] xl:h-full adult:rounded-lg"
      >
        {!drawn && (
          <p className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink-muted">
            <Icon name="county" className="size-5" />
            Loading the map…
          </p>
        )}
        {theme && (
          <Map
            mapId={mapId}
            // The site's theme, not the system's: the two differ once the theme toggle is used.
            colorScheme={theme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT}
            defaultBounds={{ ...firstView(points, nearPoint(near)), padding: EDGE }}
            // Close enough to tell two homes on one street apart, and no closer.
            maxZoom={18}
            // None of Google's buttons: the map type, Street View and the rest are not for finding a
            // home, and the zoom buttons are the site's. Its logo and the line of terms stay.
            disableDefaultUI
            // One finger, or the wheel, still scrolls the page past the map; two fingers, or Ctrl
            // and the wheel, move the map. Google says so on the map when it is tried.
            gestureHandling="cooperative"
            // Only ClearCare's pins open a card: Google's own cards for the places on its map would
            // sit beside the homes' as if they were part of the record.
            clickableIcons={false}
            onTilesLoaded={() => setDrawn(true)}
            className={`relative size-full transition-opacity duration-500 motion-reduce:transition-none adult:transition-none ${drawn ? "opacity-100" : "opacity-0"}`}
          >
            <Marks
              points={points}
              from={nearPoint(near)}
              place={place}
              chosenId={chosenId}
              pointedId={pointedId}
              chosenPin={opener}
              onChoose={(point, pin) => {
                opener.current = pin;
                choose(point.centre_id);
              }}
              onClose={close}
            />
          </Map>
        )}
      </div>
    </>
  );
}

// Everything drawn on the map, which needs the map to be there.
function Marks({
  points,
  from,
  place,
  chosenId,
  pointedId,
  chosenPin,
  onChoose,
  onClose,
}: {
  points: CentrePoint[];
  from: LatLng | null;
  place: string;
  chosenId: string | null;
  pointedId: string | null;
  chosenPin: RefObject<HTMLElement | null>;
  onChoose: (point: CentrePoint, pin: HTMLElement) => void;
  onClose: () => void;
}) {
  const map = useMap();
  // Read at every render as well as when the window changes: the map comes to rest, and renders
  // this, after anything else that changes its width, such as "Easier to read".
  const wide = useSyncExternalStore(subscribeResize, () => roomForCard(map), () => false);
  const index = useMemo(() => clusterIndex(points), [points]);

  // What the map shows, read each time it comes to rest: pins and clusters are worked out for that,
  // not for every frame of a move.
  const [view, setView] = useState<{ bounds: MapBounds; zoom: number } | null>(null);
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", () => {
      const bounds = map.getBounds()?.toJSON();
      const zoom = map.getZoom();
      if (bounds && zoom !== undefined) setView({ bounds, zoom });
    });
    return () => listener.remove();
  }, [map]);
  const marks = useMemo(() => (view ? marksIn(index, view.bounds, view.zoom) : null), [index, view]);

  // A home's card goes with its pin: zoomed out until the pin joins a cluster, or moved well out of
  // view, there is no card.
  const chosen = marks?.pins.find((point) => point.centre_id === chosenId) ?? null;
  // What the card pointed at in the list marks: its home's pin, or the cluster that holds it.
  const pointed = useMemo(() => (marks && pointedId ? markOf(index, marks, pointedId) : null), [index, marks, pointedId]);

  const [card, setCard] = useState<HTMLElement | null>(null);
  // Once a card can be seen, it is given the keyboard's focus, as it opens somewhere else in the
  // page's order than the pin that was chosen, and the map moves by what it takes for the home to be
  // seen whole: the card over its pin, or on a phone the pin above the docked card. Google keeps
  // what a mark holds hidden for a moment after React has rendered it, and a hidden card can't take
  // the focus, so this waits for it. The card's place is worked out from the pin's, not read.
  useEffect(() => {
    if (!map || !card) return;
    let frame = requestAnimationFrame(function show() {
      // The pin that was pressed is gone when the card comes back without a press: its home has
      // come out of a cluster again, or the map was made again for another theme. Nothing moves then.
      const pin = chosenPin.current;
      if (!pin?.isConnected) return;
      // Safari before 17.4 has no checkVisibility; there the card is taken as shown.
      if (card.checkVisibility?.({ visibilityProperty: true }) === false) {
        frame = requestAnimationFrame(show);
        return;
      }
      card.focus({ preventScroll: true });
      const at = pin.getBoundingClientRect();
      const frameBox = map.getDiv().getBoundingClientRect();
      const middle = { x: (at.left + at.right) / 2, y: (at.top + at.bottom) / 2 };
      const room: Box = { left: frameBox.left + EDGE / 2, top: frameBox.top + EDGE / 2, right: frameBox.right - EDGE / 2, bottom: frameBox.bottom - EDGE / 2 };
      const needed: Box = { left: at.left, top: at.top, right: at.right, bottom: at.bottom + NAME_HEIGHT };
      if (wide) {
        needed.left = Math.min(needed.left, middle.x - card.offsetWidth / 2);
        needed.right = Math.max(needed.right, middle.x + card.offsetWidth / 2);
        needed.top = middle.y - CARD_LIFT - card.offsetHeight;
        room.right = frameBox.right - BUTTONS;
      } else {
        room.bottom = card.getBoundingClientRect().top - EDGE / 4;
      }
      const { x, y } = shiftInto(needed, room);
      if (x || y) map.panBy(x, y);
    });
    return () => cancelAnimationFrame(frame);
  }, [map, card, wide, chosenPin]);

  function open(cluster: Cluster) {
    map?.moveCamera({ center: { lat: cluster.lat, lng: cluster.lng }, zoom: opensAt(index, cluster) });
  }

  return (
    <>
      {marks?.clusters.map((cluster) => (
        <ClusterPin key={`cluster-${cluster.id}`} cluster={cluster} marked={cluster === pointed} onChoose={() => open(cluster)} />
      ))}
      {marks?.pins.map((point) => (
        <HomePin key={point.centre_id} point={point} chosen={point === chosen} marked={point === pointed} onChoose={(pin) => onChoose(point, pin)} />
      ))}
      {from && <PlacePin position={from} name={place || "Chosen location"} />}

      {chosen &&
        (wide ? (
          <AdvancedMarker position={{ lat: chosen.latitude, lng: chosen.longitude }} anchorLeft="-50%" anchorTop={`calc(-100% - ${CARD_LIFT}px)`} zIndex={3}>
            {/* Google lets clicks through a mark that is not a button; the card takes its own. */}
            <div className="pointer-events-auto w-72 cursor-auto">
              <HomeCard key={chosen.centre_id} ref={setCard} point={chosen} onClose={onClose} pointed />
            </div>
          </AdvancedMarker>
        ) : (
          // Above Google's logo and its line of terms, which must stay in view.
          <div className="absolute inset-x-2 bottom-8 z-10">
            <HomeCard key={chosen.centre_id} ref={setCard} point={chosen} onClose={onClose} />
          </div>
        ))}

      <MapControl position={ControlPosition.INLINE_END_BLOCK_START}>
        <div className="m-3 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md adult:rounded-md">
          <ZoomButton label="Zoom in" path="M12 5v14M5 12h14" onClick={() => map?.setZoom((map.getZoom() ?? 0) + 1)} />
          <span className="border-t border-line-soft" />
          <ZoomButton label="Zoom out" path="M5 12h14" onClick={() => map?.setZoom((map.getZoom() ?? 0) - 1)} />
        </div>
      </MapControl>
    </>
  );
}

function ZoomButton({ label, path, onClick }: { label: string; path: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex size-11 items-center justify-center text-ink hover:bg-surface-muted">
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="size-5">
        <path d={path} />
      </svg>
    </button>
  );
}
