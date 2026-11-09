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
// Rooms and activities so far; care types and facilities to follow.

// evenodd: the solid part has holes cut in it, such as the eyes and mouths of the theatre masks.
export type AmenityIconPaths = { stroke: string; fill: string; evenodd?: true };

export const AMENITY_ICON_PATHS: Record<string, AmenityIconPaths> = {
  // Rooms
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

  // Activities
  // A television with a V-shaped aerial
  "Films and television": {
    stroke: "M7.5 3.5 12 8l4.5-4.5M4.5 8h15a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1 -2.5 2.5h-15a2.5 2.5 0 0 1 -2.5 -2.5v-8a2.5 2.5 0 0 1 2.5 -2.5z",
    fill: "",
  },
  // A radio
  "Radio": {
    stroke: "M6 8 17 3.5M4.5 8h15a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1 -2.5 2.5h-15a2.5 2.5 0 0 1 -2.5 -2.5v-8a2.5 2.5 0 0 1 2.5 -2.5zM5.5 14.5h4",
    fill: "M12.5 14.5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z",
  },
  // A hairdryer, with lines for the air
  "Hairdressing": {
    stroke: "M8 7.3 16.8 4.6a5.4 5.4 0 0 1 0 10.8L8 13.2a1.2 1.2 0 0 1-1.2-1.2V8.5A1.2 1.2 0 0 1 8 7.3zM13.4 14.6l.9 6.4h2.6l.6-5.8M15.6 21v1.5M1.5 7.4h2.5M1 10.25h3M1.5 13.1h2.5",
    fill: "",
  },
  // Two quavers joined by a beam
  "Music and singing": {
    stroke: "M9 18.5V6.5l11-2.5v12",
    fill: "M9 6.5l11-2.5v3L9 9.5zM3.75 18.5a2.75 2.1 0 1 0 5.5 0a2.75 2.1 0 1 0 -5.5 0zM14.75 16a2.75 2.1 0 1 0 5.5 0a2.75 2.1 0 1 0 -5.5 0z",
  },
  // A paintbrush
  "Arts and crafts": {
    stroke: "M21 3l-8 8",
    fill: "M11.6 10.2l2.2 2.2-1.6 1.6-2.2-2.2zM8.8 13.2c-2 .1-3.4 1.6-3.4 3.4 0 1.6-1 2.6-3.2 3.2 3.5 1.3 8 .4 9-2.4.6-1.6.1-3.2-1.2-4.1z",
  },
  // An open book and a pen
  "Reading and writing": {
    stroke: "M11 7C9 5.5 6 5 3 5.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V13M11 7v13",
    fill: "M20.4 2.6l1.5 1.5-7 7-2.3.8.8-2.3z",
  },
  // A paw print
  "Pet therapy": {
    stroke: "",
    fill: "M12 12.5c-2.8 0-5.5 3.1-5.5 5.6 0 1.6 1.2 2.4 2.6 2.4 1.2 0 1.9-.6 2.9-.6s1.7.6 2.9.6c1.4 0 2.6-.8 2.6-2.4 0-2.5-2.7-5.6-5.5-5.6zM2.5 10.5a2 2.6 0 1 0 4 0a2 2.6 0 1 0 -4 0zM17.5 10.5a2 2.6 0 1 0 4 0a2 2.6 0 1 0 -4 0zM6.9 5.5a2.1 2.8 0 1 0 4.2 0a2.1 2.8 0 1 0 -4.2 0zM12.9 5.5a2.1 2.8 0 1 0 4.2 0a2.1 2.8 0 1 0 -4.2 0z",
  },
  // A bottle of nail polish, its brush lifted out
  "Beauty and nail care": {
    stroke: "M5.5 11h5a3 3 0 0 1 3 3v4.5a3 3 0 0 1 -3 3h-5a3 3 0 0 1 -3 -3v-4.5a3 3 0 0 1 3 -3zM5.5 11V8.5h5V11M18.25 9v7.5",
    fill: "M4.2 16h7.6v1.8a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2zM17 2h2.5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-2.5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1zM18.25 16c-1 1.3-1.7 2.6-1.7 3.5a1.7 1.7 0 0 0 3.4 0c0-.9-.7-2.2-1.7-3.5z",
  },
  // A ball of yarn with two knitting needles through it
  "Knitting and sewing": {
    stroke: "M3 14a7 7 0 1 0 14 0a7 7 0 1 0 -14 0zM3.2 12.6c4.2-1 9.4 1 12.4 5.6M6.6 7.9c4.4.4 8.6 3.6 10.3 7.5M5.6 19.4c.6-4.2 3.4-8.4 7.6-11.8M13.2 9.4 19.4 3.2M15.4 11.6l5.8-5.8M4.8 19c-1.5.9-2.5 2-3.3 3.5",
    fill: "M18.7 2.6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM20.5 5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0z",
  },
  // A figure walking
  "Walking": {
    stroke: "M12.5 8 10.5 14l3 3 1 4.5M10.5 14 8 21M12.5 8.5l3 3.5 3 .5M12 8.5 8.5 10.5 7.5 14",
    fill: "M11.25 4.25a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 1 0 -4.5 0z",
  },
  // A cupcake
  "Cooking and baking": {
    stroke: "M4.5 12.5c-1.4-2.6.3-5.4 3.1-5.3.7-2.4 3.1-3.6 5.4-2.8 2.1-1.3 5.1 0 5.5 2.6 2.4.4 3.4 3.3 1.5 5.5",
    fill: "M4 12h16l-2 9H6zM10.5 2.8a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0z",
  },
  // The theatre's happy and sad masks, their eyes and mouths cut out
  "Drama and performances": {
    stroke: "",
    fill: "M1.5 4.2c3.5-1.4 7-1.4 10.5 0V10a5.25 5.25 0 0 1-10.5 0zM3.35 7.6a1.25 0.9 0 1 0 2.5 0a1.25 0.9 0 1 0 -2.5 0zM7.65 7.6a1.25 0.9 0 1 0 2.5 0a1.25 0.9 0 1 0 -2.5 0zM4.2 10.6h5.1a2.55 2.55 0 0 1-5.1 0zM12 9.2c3.5-1.4 7-1.4 10.5 0V15a5.25 5.25 0 0 1-10.5 0zM13.85 12.6a1.25 0.9 0 1 0 2.5 0a1.25 0.9 0 1 0 -2.5 0zM18.15 12.6a1.25 0.9 0 1 0 2.5 0a1.25 0.9 0 1 0 -2.5 0zM14.7 18.1a2.55 2.55 0 0 1 5.1 0z",
    evenodd: true,
  },
  // A basketball
  "Ball and movement games": {
    stroke: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0zM3 12h18M12 3v18M5.6 5.6c3.2 3.2 3.2 9.6 0 12.8M18.4 5.6c-3.2 3.2-3.2 9.6 0 12.8",
    fill: "",
  },
  // A chapel with a cross on top
  "Religious services and prayer": {
    stroke: "M12 1.5v4.5M10 3.5h4M4.5 21.5V12l7.5-5.5 7.5 5.5v9.5z",
    fill: "M10 21.5v-3.5a2 2 0 0 1 4 0v3.5z",
  },
  // A dumbbell
  "Exercise classes": {
    stroke: "M7 12h10",
    fill: "M3.5 8.5h0.5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-0.5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1zM6 6h1a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1zM17 6h1a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1zM20 8.5h0.5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-0.5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z",
  },
  // A framed photo
  "Reminiscence activities": {
    stroke: "M4.5 4h15a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-15a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z",
    fill: "M5 17.5l4.5-5.5 3 3.5 2-2 4.5 4zM13.9 8.5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0z",
  },
  // A minibus
  "Outings": {
    stroke: "M2.5 17V7a2 2 0 0 1 2-2h11.5l5.5 5.5V17z",
    fill: "M5.25 7h2.5a0.75 0.75 0 0 1 0.75 0.75v2a0.75 0.75 0 0 1 -0.75 0.75h-2.5a0.75 0.75 0 0 1 -0.75 -0.75v-2a0.75 0.75 0 0 1 0.75 -0.75zM10.75 7h2.5a0.75 0.75 0 0 1 0.75 0.75v2a0.75 0.75 0 0 1 -0.75 0.75h-2.5a0.75 0.75 0 0 1 -0.75 -0.75v-2a0.75 0.75 0 0 1 0.75 -0.75zM15.5 7h.5l3.5 3.5h-4zM4.8 18a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0zM14.8 18a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0z",
  },
  // Sparkles
  "Sensory activities": {
    stroke: "",
    fill: "M10 5Q11.44 11.56 18 13Q11.44 14.44 10 21Q8.56 14.44 2 13Q8.56 11.56 10 5zM18.5 2Q19.13 4.87 22 5.5Q19.13 6.13 18.5 9Q17.87 6.13 15 5.5Q17.87 4.87 18.5 2zM19 16Q19.45 18.05 21.5 18.5Q19.45 18.95 19 21Q18.55 18.95 16.5 18.5Q18.55 18.05 19 16z",
  },
  // A sunflower in a pot. Its stem and pot keep it apart from Sonas's sun.
  "Gardening and flower arranging": {
    stroke: "M12 12.8v2.7",
    fill: "M10.61 3.4L12 0.3L13.39 3.4zM12.7 3.17L15.64 1.48L14.95 4.8zM14.52 4.22L17.9 4.58L15.38 6.86zM15.38 6.14L17.9 8.42L14.52 8.78zM14.95 8.2L15.64 11.52L12.7 9.83zM13.39 9.6L12 12.7L10.61 9.6zM11.3 9.83L8.36 11.52L9.05 8.2zM9.48 8.78L6.1 8.42L8.62 6.14zM8.62 6.86L6.1 4.58L9.48 4.22zM9.05 4.8L8.36 1.48L11.3 3.17zM9.4 6.5a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0zM6 15.5h12v2H6zM7 18.2h10l-1 3.3H8z",
  },
  // A figure dancing
  "Dancing": {
    stroke: "M13 8 11 14M13 8.2l5 2.8 1.5-1.5M13 8.2 9.5 6.5 8 3.5M11 14l4.5 2.5-.5 5M11 14l-4 4.5-2.5-.5",
    fill: "M12.75 4.5a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 1 0 -4.5 0z",
  },
  // A bingo card with three numbers marked
  "Bingo": {
    stroke: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2zM9 3v18M15 3v18M3 9h18M3 15h18",
    fill: "M4.3 6a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0zM10.3 12a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0zM16.3 18a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0z",
  },
  // A question mark on a tile
  "Quizzes and word games": {
    stroke: "M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3zM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5",
    fill: "M10.75 17a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0z",
  },
  // Two playing cards
  "Board and card games": {
    stroke: "M8.5 7.2 4.6 8.4a1 1 0 0 0-.7 1.2l3.2 10.6a1 1 0 0 0 1.2.7l1-.3M11.5 3.5h8a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1 -1.5 1.5h-8a1.5 1.5 0 0 1 -1.5 -1.5v-13.5a1.5 1.5 0 0 1 1.5 -1.5z",
    fill: "M15.5 15.01C11.18 12.04 11.99 8.53 13.88 8.8C14.82 8.94 15.5 9.61 15.5 10.42C15.5 9.61 16.18 8.94 17.12 8.8C19.01 8.53 19.82 12.04 15.5 15.01z",
  },
  // Two speech bubbles
  "Talks and discussion groups": {
    stroke: "M3 3.5h10a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H8l-3.5 3v-3H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1zM17 8h4a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-1.5v3l-3.5-3h-5a1 1 0 0 1-1-1V15",
    fill: "",
  },
  // Two balloons
  "Social gatherings and celebrations": {
    stroke: "M8.5 13.2c0 2.8 1.7 4.8 3 7.8M15.5 11.7c0 3.3-1.8 5.8-3.3 9.3",
    fill: "M4.9 8a3.6 4.6 0 1 0 7.2 0a3.6 4.6 0 1 0 -7.2 0zM11.9 6.5a3.6 4.6 0 1 0 7.2 0a3.6 4.6 0 1 0 -7.2 0zM7.8 12.4h1.4l.4 1h-2.2zM14.8 10.9h1.4l.4 1h-2.2z",
  },
  // The male symbol
  "Men’s groups": {
    stroke: "M3.5 14.5a6 6 0 1 0 12 0a6 6 0 1 0 -12 0zM13.8 10.2 20.5 3.5M15 3.5h5.5V9",
    fill: "",
  },
  // A brain seen from the side: the front on the left, the smaller lobe at the back, the stem
  "Cognitive stimulation therapy": {
    stroke: "M5 15.6C3 15.1 1.8 13.1 2.3 11.1c-.6-2 .6-4 2.5-4.5.6-2 2.7-3.2 4.7-2.6 1.4-1.4 3.8-1.6 5.4-.4 2-.6 4.2.4 5 2.4 1.8.6 2.8 2.6 2.2 4.4.8 1.6.2 3.6-1.4 4.4M19.4 15.6c.3 1.9-1.2 3.4-3.1 3.4-1.3 0-2.3-.7-2.7-1.7M5 15.6c1.2 1.4 3.4 1.8 5 1.2 1.2.8 2.9.6 3.7-.6M14.6 17.6l.6 3.6M7.4 12.6c2-.9 4.3-.6 6.1.8 1 .8 2.4.8 3.4 0M6.2 9.4c1-.9 2.5-.9 3.5 0M11.2 6.4c.2 1.4 1.4 2.4 2.8 2.4M17.2 8.2c-.6 1.2-.2 2.6 1 3.2",
    fill: "",
  },
  // A sun: sonas is Irish for happiness
  "Sonas": {
    stroke: "M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8",
    fill: "M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0z",
  },
  // A figure stretching, with an arrow for the movement
  "Physiotherapy": {
    stroke: "M11 8.5v6.5l-2.5 6.5M11 15l3 6.5M11 9.5 7 7M11 9.5l4-5M17.5 9a6 6 0 0 1 1.3 6.5",
    fill: "M9 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0zM20.3 14.6l-.9 3.4-2.6-2.3z",
  },
  // A puzzle piece
  "Occupational therapy": {
    stroke: "M4 7h4a2.25 2.25 0 1 1 4.5 0H17v4.5a2.25 2.25 0 1 1 0 4.5V20.5H12.5a2.25 2.25 0 1 0-4.5 0H4V16a2.25 2.25 0 1 0 0-4.5z",
    fill: "",
  },
  // A note and a heart
  "Music therapy": {
    stroke: "M8.5 17.5V4l6.5 2.5",
    fill: "M3.25 17.5a2.75 2.1 0 1 0 5.5 0a2.75 2.1 0 1 0 -5.5 0zM17.5 18.66C12.38 15.14 13.34 10.98 15.58 11.3C16.7 11.46 17.5 12.26 17.5 13.22C17.5 12.26 18.3 11.46 19.42 11.3C21.66 10.98 22.62 15.14 17.5 18.66z",
  },
  // A painter's palette
  "Art therapy": {
    stroke: "M12 3a9 9 0 0 0 0 18c1.5 0 2.2-1 2.2-2 0-1.2-1-1.6-1-2.6s.9-1.9 2.3-1.9H18a3 3 0 0 0 3-3c0-4.7-4-8.5-9-8.5z",
    fill: "M6.1 11a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0zM8.4 7a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0zM13.1 7a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0zM15.8 10.5a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0z",
  },
  // A drop of oil with a leaf
  "Aromatherapy": {
    stroke: "M12 3.5s-6 6.6-6 10.8a6 6 0 0 0 12 0c0-4.2-6-10.8-6-10.8z",
    fill: "M18.5 2.5c-2.8 0-4.5 1.6-4.5 4 2.8 0 4.5-1.6 4.5-4z",
  },
  // A lotus
  "Meditation and relaxation": {
    stroke: "M12 5c1.9 1.9 3 4.4 3 7s-1.1 4.6-3 6c-1.9-1.4-3-3.4-3-6s1.1-5.1 3-7zM9.3 9.6C7 8.8 4.6 8.8 2.5 9.7c.5 4.2 3.8 7.8 9.5 8.3M14.7 9.6c2.3-.8 4.7-.8 6.8.1-.5 4.2-3.8 7.8-9.5 8.3M5 21.5h14",
    fill: "",
  },
  // A hand, with a line for its movement
  "Massage": {
    stroke: "M8.5 21v-3.5l-3.2-3.8a1.5 1.5 0 0 1 2.2-2l1.5 1.5V5.5a1.5 1.5 0 0 1 3 0v5.5V4a1.5 1.5 0 0 1 3 0v7V5.5a1.5 1.5 0 0 1 3 0v6V8a1.5 1.5 0 0 1 3 0v8c0 3-2.2 5-5 5zM2.5 8c-1 2.2-1 4.6 0 6.8",
    fill: "",
  },
};
