"use client";

// components/search/map-pins.tsx
// What the search page's map draws (CCARE-229): a pin for a home, a cluster for homes too close to
// draw apart, and a mark for the place the search measures from. They are the site's own, drawn in
// its colours, so they follow its theme and its "Easier to read" design.
//
// Every home's pin is the same, and a cluster's colour is the pins': a colour, shape or label that
// differed between homes would read as a judgment of them, and ClearCare doesn't rank homes. Only a
// cluster's size follows its count.
import { Icon } from "@/components/ui/icons";
import type { Cluster } from "@/lib/map-clusters";
import type { CentrePoint, LatLng } from "@/lib/search-map";
import { AdvancedMarker, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";
import { useState } from "react";

// Each mark sits with its middle on its point, not its foot as Google's own pin does.
const MIDDLE = { anchorLeft: "-50%", anchorTop: "-50%" };

// The disc of a pin and of a cluster. Its edge in the surface colour keeps two that touch apart.
const DISC = "flex items-center justify-center rounded-full border-2 border-surface bg-primary text-on-primary shadow-md";
// A name under a mark.
const NAME = "absolute top-full max-w-60 truncate rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-ink shadow-sm";
// The keyboard's focus is on Google's element round a mark, which the site's outline would box in a
// square; the disc inside takes the outline instead.
const FOCUS =
  "[gmp-advanced-marker:focus-visible_&]:outline-2 [gmp-advanced-marker:focus-visible_&]:outline-offset-2 [gmp-advanced-marker:focus-visible_&]:outline-focus adult:[gmp-advanced-marker:focus-visible_&]:outline-3";
const LIFT = "group-hover:-translate-y-0.5 group-hover:scale-110 [gmp-advanced-marker:focus-visible_&]:-translate-y-0.5 [gmp-advanced-marker:focus-visible_&]:scale-110";
const MOVES = "transition-[scale,translate] duration-150 motion-reduce:transition-none adult:transition-none";
// A marked cluster: lifted as under the pointer, with a line round its halo.
const MARKED = "-translate-y-0.5 scale-110 outline-3 outline-offset-4 outline-primary";

// One home. Its box is 44 pixels across, a finger's width, round a smaller disc, so that two homes a
// street apart are still two discs. The chosen one is larger, in front, and named. So is the marked
// one, whose card is pointed at in the list beside the map (CCARE-230): its size and its name say
// which home it is, not a colour, which would set it apart from the others (above).
export function HomePin({ point, chosen, marked, onChoose }: { point: CentrePoint; chosen: boolean; marked: boolean; onChoose: (pin: HTMLElement) => void }) {
  const [ref, pin] = useAdvancedMarkerRef();
  const [hovered, setHovered] = useState(false);
  const large = chosen || marked;

  return (
    <AdvancedMarker
      ref={ref}
      position={{ lat: point.latitude, lng: point.longitude }}
      title={point.centre_name}
      {...MIDDLE}
      zIndex={large ? 2 : hovered ? 1 : 0}
      onClick={() => pin && onChoose(pin)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex size-11 flex-col items-center justify-center"
    >
      <span className={`${DISC} ${FOCUS} ${MOVES} ${large ? "size-10" : `size-7 ${LIFT}`}`}>
        <Icon name="home" className={large ? "size-5" : "size-3.5"} />
      </span>
      {large && <span className={NAME}>{point.centre_name}</span>}
    </AdvancedMarker>
  );
}

// Homes too close to draw apart, as their count. Choosing it opens the map on them. The marked one
// holds the home whose card is pointed at in the list beside the map: it is larger and in front,
// with a line round it. Size alone would not say so, since a cluster's size follows its count.
export function ClusterPin({ cluster, marked, onChoose }: { cluster: Cluster; marked: boolean; onChoose: () => void }) {
  const size = cluster.count < 10 ? "size-9" : cluster.count < 50 ? "size-11" : "size-13";

  return (
    <AdvancedMarker
      position={{ lat: cluster.lat, lng: cluster.lng }}
      title={`${cluster.count} nursing homes. Zoom in to see them.`}
      {...MIDDLE}
      // Left to Google, a mark's place in the pile follows how far down the map it is, and a cluster
      // low on the map would cover a chosen home's card.
      zIndex={marked ? 1 : 0}
      onClick={onChoose}
      className="group flex size-14 items-center justify-center"
    >
      <span className={`${DISC} ${FOCUS} ${MOVES} ${marked ? MARKED : LIFT} ${size} text-sm font-semibold ring-4 ring-primary/25`}>{cluster.count}</span>
    </AdvancedMarker>
  );
}

// Where the search measures from: smaller than a home, in the surface colour with the crosshairs of
// "Use my location", always named, behind the pins and not a button.
export function PlacePin({ position, name }: { position: LatLng; name: string }) {
  return (
    <AdvancedMarker position={position} title={name} {...MIDDLE} zIndex={-1} className="relative flex size-6 flex-col items-center justify-center">
      <span className="flex size-6 items-center justify-center rounded-full border border-ink bg-surface text-ink shadow-sm">
        <Icon name="location" className="size-4" />
      </span>
      <span className={`${NAME} mt-1`}>{name}</span>
    </AdvancedMarker>
  );
}
