// lib/search-map.ts
// The search page's map (CCARE-229): a point for each home the search matches, and what the map
// shows: first, and when a home's card opens. What it draws at a zoom is in lib/map-clusters.ts. No
// imports, so the tests load this file as it is (tests/search-map.test.ts).

// A home as a pin (CentrePoint in api/openapi.yaml). The coordinates are Google's, which only
// GET /centres/points gives, and only to the site's server (ADR-0029).
export interface CentrePoint {
  centre_id: string;
  centre_name: string;
  address: string;
  county: string;
  latitude: number;
  longitude: number;
  distance_m: number | null; // from near, in whole metres; null without near
}

export interface LatLng {
  lat: number;
  lng: number;
}

// The edges of what the map shows, as Google's LatLngBoundsLiteral names them.
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// How many of the nearest homes the first view holds when the search has a place.
const NEAREST = 5;
// The least the first view shows either side of its middle, in degrees: about 3 km in Ireland, the
// size of a town. Without it, one pin, or a few on one street, would open at the closest zoom.
const LEAST = { lat: 0.03, lng: 0.05 };

// near as the page address holds it ("53.32,-6.27", already checked by readNear), or null for none.
export function nearPoint(near: string): LatLng | null {
  if (!near) return null;
  const [lat, lng] = near.split(",").map(Number);
  return { lat, lng };
}

// What the map shows first. With a place: centred on it, out to the nearest few homes, since a
// place only orders the homes and the far ones would shrink the view to the whole country. Without
// one: every pin.
export function firstView(points: CentrePoint[], near: LatLng | null): MapBounds {
  if (near) {
    const nearest = [...points].sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity)).slice(0, NEAREST);
    const lat = Math.max(LEAST.lat, ...nearest.map((point) => Math.abs(point.latitude - near.lat)));
    const lng = Math.max(LEAST.lng, ...nearest.map((point) => Math.abs(point.longitude - near.lng)));
    return { north: near.lat + lat, south: near.lat - lat, east: near.lng + lng, west: near.lng - lng };
  }
  const { north, south, east, west } = boundsOf(points);
  const middle = { lat: (north + south) / 2, lng: (east + west) / 2 };
  return {
    north: Math.max(north, middle.lat + LEAST.lat),
    south: Math.min(south, middle.lat - LEAST.lat),
    east: Math.max(east, middle.lng + LEAST.lng),
    west: Math.min(west, middle.lng - LEAST.lng),
  };
}

function boundsOf(points: CentrePoint[]): MapBounds {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  return { north: Math.max(...latitudes), south: Math.min(...latitudes), east: Math.max(...longitudes), west: Math.min(...longitudes) };
}

// A box on the screen, in pixels.
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// How far the map's view has to move, in pixels, for box to be inside frame: what is cut off at each
// edge, and nothing where it is already in. A chosen home's card is brought into the map with it.
export function shiftInto(box: Box, frame: Box) {
  return {
    x: box.left < frame.left ? box.left - frame.left : Math.max(0, box.right - frame.right),
    y: box.top < frame.top ? box.top - frame.top : Math.max(0, box.bottom - frame.bottom),
  };
}
