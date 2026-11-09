// lib/amenity-icons.ts
// Small pictures beside amenities (CCARE-225) on a 24-unit grid, like the site's other icons
// (components/ui/icons.tsx). Keyed by the item exactly as the API names it (the `item` in
// lib/search-filters.ts), so the same item has the same picture on the centre page, Compare Homes
// and anywhere else. An item without a picture shows its words alone.
//
// The icons only help a reader scan: the words beside each one always say what it is, so they are
// hidden from screen readers and no legend is needed. Each has a 2px stroke, like the site's other
// icons, and solid parts: beds drawn only in outline looked like boxes or chairs at 16px, while a
// solid mattress and pillows read as a bed at a glance, as on travel sites. Beds are seen from
// their foot, so a single and a double differ by width and pillows. Headboards are low and nearly
// square-cornered, and the narrow beds of shared rooms have no pillow: a tall, round-topped
// headboard with a small pillow high in it looked like a cartoon figure. Beds seen from above were
// tried too, but at 16px a single looked like a door. They are our own drawings, not copies of
// another site's icons. None is a circle, so none looks like a judgement mark (judgement-icon.tsx).
//
// Rooms first; facilities and activities to follow.

export type AmenityIconPaths = { stroke: string; fill: string };

export const AMENITY_ICON_PATHS: Record<string, AmenityIconPaths> = {
  // A bed with one pillow
  "Single room": {
    stroke: "M5.25 13V7.25a0.75 0.75 0 0 1 0.75 -0.75h12a0.75 0.75 0 0 1 0.75 0.75V13M5 17.5v3M19 17.5v3",
    fill: "M5 12.5h14a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1zM8.5 8.75h7a0.75 0.75 0 0 1 0.75 0.75v0.75a0.75 0.75 0 0 1 -0.75 0.75h-7a0.75 0.75 0 0 1 -0.75 -0.75v-0.75a0.75 0.75 0 0 1 0.75 -0.75z",
  },
  // A wide bed with two pillows. Twin and double rooms are one item in the vocabulary, and both are a
  // room for two.
  "Twin/double room": {
    stroke: "M2.75 13V7.25a0.75 0.75 0 0 1 0.75 -0.75h17a0.75 0.75 0 0 1 0.75 0.75V13M2.5 17.5v3M21.5 17.5v3",
    fill: "M2.5 12.5h19a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-19a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1zM6 8.75h4.75a0.75 0.75 0 0 1 0.75 0.75v0.75a0.75 0.75 0 0 1 -0.75 0.75h-4.75a0.75 0.75 0 0 1 -0.75 -0.75v-0.75a0.75 0.75 0 0 1 0.75 -0.75zM13.25 8.75h4.75a0.75 0.75 0 0 1 0.75 0.75v0.75a0.75 0.75 0 0 1 -0.75 0.75h-4.75a0.75 0.75 0 0 1 -0.75 -0.75v-0.75a0.75 0.75 0 0 1 0.75 -0.75z",
  },
  // Two low beds, with a third headboard behind them: more than two people
  "Multi-bed room": {
    stroke: "M7 12V8.75A.75.75 0 0 1 7.75 8h8.5a.75.75 0 0 1 .75.75V12M2.25 15V12.75a0.75 0.75 0 0 1 0.75 -0.75h6.5a0.75 0.75 0 0 1 0.75 0.75V15M2 18.5v2M10.5 18.5v2M13.75 15V12.75a0.75 0.75 0 0 1 0.75 -0.75h6.5a0.75 0.75 0 0 1 0.75 0.75V15M13.5 18.5v2M22 18.5v2",
    fill: "M2 14.5h8.5a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-8.5a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1zM13.5 14.5h8.5a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-8.5a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1z",
  },
  // Two low beds side by side: shared, though the report doesn't say by how many
  "Shared room, occupancy unspecified": {
    stroke: "M2.25 13V10.75a0.75 0.75 0 0 1 0.75 -0.75h6.5a0.75 0.75 0 0 1 0.75 0.75V13M2 16.5v2M10.5 16.5v2M13.75 13V10.75a0.75 0.75 0 0 1 0.75 -0.75h6.5a0.75 0.75 0 0 1 0.75 0.75V13M13.5 16.5v2M22 16.5v2",
    fill: "M2 12.5h8.5a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-8.5a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1zM13.5 12.5h8.5a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-8.5a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1z",
  },
  // A bath with a tap
  "En-suite facilities": {
    stroke: "M6 12V6a2 2 0 0 1 4 0M7 20l-1 1.5M17 20l1 1.5",
    fill: "M2.5 11h19v3a6.5 6.5 0 0 1-6.5 6.5H9A6.5 6.5 0 0 1 2.5 14z",
  },
  // Two figures either side of a line, as on a shared washroom's door. The dress has shoulders: one
  // that came to a point under the head looked detached from it.
  "Shared bathroom facilities": {
    stroke: "M12 3v18M5.5 15v5M7.5 15v5M16.5 15.5V20M18.5 15.5V20",
    fill: "M6.5 7.25a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4.25 8h4.5a.5.5 0 0 1 .5.55l-.6 6.95H4.35l-.6-6.95a.5.5 0 0 1 .5-.55zM17.5 7.25a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.25 8h2.5a.5.5 0 0 1 .47.33L21.5 15.5h-8l2.28-7.17a.5.5 0 0 1 .47-.33z",
  },
};
