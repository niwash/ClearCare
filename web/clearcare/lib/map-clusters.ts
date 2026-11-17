// lib/map-clusters.ts
// What the search page's map draws at a zoom (CCARE-229): a pin for a home on its own, and one
// cluster with a count where pins would pile up, as Dublin's 120 homes do on a map of the country.
// Supercluster does the grouping; this file holds how close is too close and what the map is given.
// The tests load it as it is (tests/map-clusters.test.ts), so its import is named with its extension.
import Supercluster from "supercluster";

import type { CentrePoint, MapBounds } from "./search-map.ts";

// Homes too close to draw apart at this zoom, as one mark at their middle.
export interface Cluster {
  id: number;
  lat: number;
  lng: number;
  count: number;
}

export interface Marks {
  pins: CentrePoint[];
  clusters: Cluster[];
}

export type ClusterIndex = Supercluster<CentrePoint>;

// Homes nearer than this on screen, in pixels, share a cluster: a pin is 44 across with the space
// round it that a finger needs.
const RADIUS = 44;
// The closest zoom that still clusters. From the next one, where a street is some 70 pixels wide,
// every home is its own pin, however near its neighbour.
const CLOSEST = 16;
// How far past the map's edges marks are still drawn, as a share of its width and height, so they
// are there before a small move brings them in.
const MARGIN = 0.2;

export function clusterIndex(points: CentrePoint[]): ClusterIndex {
  // Google's map tiles are 256 pixels wide, which makes the radius one in screen pixels.
  return new Supercluster<CentrePoint>({ radius: RADIUS, extent: 256, maxZoom: CLOSEST }).load(
    points.map((point) => ({
      type: "Feature",
      properties: point,
      geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
    })),
  );
}

// The marks in view. Google's zoom can sit between two levels; clusters are those of the level below.
export function marksIn(index: ClusterIndex, view: MapBounds, zoom: number): Marks {
  const lat = (view.north - view.south) * MARGIN;
  const lng = (view.east - view.west) * MARGIN;
  const marks: Marks = { pins: [], clusters: [] };
  for (const { properties, geometry } of index.getClusters([view.west - lng, view.south - lat, view.east + lng, view.north + lat], Math.floor(zoom))) {
    if ("cluster" in properties) {
      const [lng, lat] = geometry.coordinates;
      marks.clusters.push({ id: properties.cluster_id, lat, lng, count: properties.point_count });
    } else {
      marks.pins.push(properties);
    }
  }
  return marks;
}

// What a home is drawn as among the marks: its own pin, or the cluster that holds it. null for a
// home out of view, or with no point. The card pointed at in the list beside the map marks it
// (CCARE-230).
export function markOf(index: ClusterIndex, marks: Marks, centreId: string): CentrePoint | Cluster | null {
  const pin = marks.pins.find((point) => point.centre_id === centreId);
  if (pin) return pin;
  const holds = (cluster: Cluster) => index.getLeaves(cluster.id, Infinity).some((leaf) => leaf.properties.centre_id === centreId);
  return marks.clusters.find(holds) ?? null;
}

// The zoom a chosen cluster opens at: the first one where it is more than one mark. A view fitted
// to its homes is not enough: on a short map it can stay at the zoom that clusters them.
export function opensAt(index: ClusterIndex, cluster: Cluster) {
  return index.getClusterExpansionZoom(cluster.id);
}
