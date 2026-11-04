// lib/search-filters.ts
// The search page's care and amenity filters (CCARE-189): which options there are, how they read in
// the page address, and what they send to GET /centres. Each option is one item from the amenities
// v2 lists (CCARE-195), so the API can count it on its own, and every item is an option: the ones
// families ask about most first, the rest ("more") after them, behind the group's "Show all".
// Options families asked for that the reports can't answer yet (a secure garden, a room for couples,
// Mass on site and so on) are left out until there's data for them. Only type imports, so the tests
// can load this file as it is.

// The four lists, keyed as the page address names them, with the API's parameter for each.
export type FilterGroupKey = "care" | "room" | "fac" | "act";

export interface FilterOption {
  slug: string; // in the page address: ?care=dementia
  item: string; // the v2 item, as the API takes and returns it
  label: string;
  help?: string;
  more?: boolean; // one of the rarer options, after the main ones and shown without a count
}

export interface FilterGroup {
  key: FilterGroupKey;
  param: "care_type" | "room_type" | "facility" | "activity"; // the API's query parameter
  list: "care_types" | "room_types" | "facilities" | "activities"; // the list on each centre
  title: string;
  // "all": a home must have every option ticked; "any": at least one.
  mode: "all" | "any";
  openByDefault: boolean;
  options: FilterOption[];
}

export const FILTER_GROUPS: FilterGroup[] = [
  {
    key: "care",
    param: "care_type",
    list: "care_types",
    title: "Care types",
    mode: "all",
    openByDefault: true,
    options: [
      { slug: "long-term", item: "Long-term residential care", label: "Long-term residential care", help: "Living in the home permanently" },
      { slug: "dementia", item: "Dementia care", label: "Dementia care" },
      { slug: "respite", item: "Respite care", label: "Respite care", help: "Short stays, often to give family carers a break" },
      { slug: "convalescent", item: "Convalescent care", label: "Convalescent care", help: "Recovery after a hospital stay" },
      { slug: "step-down", item: "Step-down care", label: "Step-down care", help: "From hospital to home, by way of a short stay" },
      { slug: "palliative", item: "Palliative care", label: "Palliative care", help: "Comfort-focused care" },
      { slug: "end-of-life", item: "End-of-life care", label: "End-of-life care" },
      { slug: "physical-disability", item: "Physical disability care", label: "Physical disability care" },
      { slug: "intellectual-disability", item: "Intellectual disability care", label: "Intellectual disability care" },
      { slug: "mental-health", item: "Mental health care", label: "Mental health care" },
      { slug: "general-nursing", item: "General nursing care", label: "General nursing care", more: true },
      { slug: "short-term", item: "Short-term care", label: "Short-term care", more: true },
      { slug: "transitional", item: "Transitional care", label: "Transitional care", more: true },
      { slug: "rehabilitation", item: "Rehabilitation", label: "Rehabilitation", more: true },
      { slug: "day-care", item: "Day care", label: "Day care", more: true },
      { slug: "brain-injury", item: "Acquired brain injury care", label: "Acquired brain injury care", more: true },
      { slug: "sensory-impairment", item: "Sensory impairment care", label: "Sensory impairment care", more: true },
      { slug: "neurological", item: "Neurological care", label: "Neurological care", more: true },
    ],
  },
  {
    key: "room",
    param: "room_type",
    list: "room_types",
    title: "Room types",
    mode: "any",
    openByDefault: true,
    options: [
      { slug: "single", item: "Single room", label: "Single room" },
      { slug: "en-suite", item: "En-suite facilities", label: "En-suite bathroom" },
      { slug: "twin", item: "Twin/double room", label: "Twin / double room" },
      { slug: "multi", item: "Multi-bed room", label: "Multi-occupancy room", help: "Three or more people sharing" },
      { slug: "shared", item: "Shared room, occupancy unspecified", label: "Shared room, number sharing not stated", more: true },
      { slug: "shared-bathroom", item: "Shared bathroom facilities", label: "Shared bathroom", more: true },
    ],
  },
  {
    key: "fac",
    param: "facility",
    list: "facilities",
    title: "Facilities",
    mode: "all",
    openByDefault: true,
    options: [
      { slug: "garden", item: "Garden", label: "Garden" },
      { slug: "parking", item: "Visitor parking", label: "Visitor parking" },
      { slug: "cafe", item: "Café/coffee dock", label: "Café" },
      { slug: "chapel", item: "Chapel/oratory", label: "Oratory / chapel" },
      { slug: "salon", item: "Hairdressing/beauty salon", label: "Hair salon" },
      { slug: "physio-room", item: "Physiotherapy room", label: "Physio room" },
      { slug: "sensory-room", item: "Sensory room", label: "Sensory room" },
      { slug: "wifi", item: "Resident internet/Wi-Fi", label: "Wi-Fi for residents" },
      { slug: "courtyard", item: "Courtyard", label: "Courtyard", more: true },
      { slug: "patio", item: "Patio/terrace", label: "Patio / terrace", more: true },
      { slug: "balcony", item: "Balcony", label: "Balcony", more: true },
      { slug: "outdoor", item: "Outdoor space, type unspecified", label: "Other outdoor space", more: true },
      { slug: "lounge", item: "Lounge/day room", label: "Lounge / day room", more: true },
      { slug: "dining-room", item: "Dining room", label: "Dining room", more: true },
      { slug: "activities-room", item: "Activities room", label: "Activities room", more: true },
      { slug: "family-room", item: "Private visitors/family room", label: "Private visitors' / family room", more: true },
      { slug: "sun-room", item: "Conservatory/sun room", label: "Conservatory / sun room", more: true },
      { slug: "quiet-room", item: "Quiet/relaxation room", label: "Quiet room", more: true },
      { slug: "prayer-room", item: "Prayer/reflection room", label: "Prayer / reflection room", more: true },
      { slug: "library", item: "Library", label: "Library", more: true },
      { slug: "cinema", item: "Cinema room", label: "Cinema room", more: true },
      { slug: "games-room", item: "Games room", label: "Games room", more: true },
      { slug: "gym", item: "Gym", label: "Gym", more: true },
      { slug: "shop", item: "Shop", label: "Shop", more: true },
      { slug: "smoking", item: "Designated smoking area", label: "Smoking area", more: true },
      { slug: "ot-room", item: "Occupational therapy room", label: "Occupational therapy room", more: true },
      { slug: "hydrotherapy", item: "Hydrotherapy pool/bathroom", label: "Hydrotherapy pool or bath", more: true },
      { slug: "lift", item: "Passenger lift", label: "Passenger lift", more: true },
      { slug: "stairlift", item: "Stairlift", label: "Stairlift", more: true },
      { slug: "dementia-unit", item: "Dementia-specific unit", label: "Dementia unit", more: true },
      { slug: "mental-health-unit", item: "Mental-health-specific unit", label: "Mental health unit", more: true },
      { slug: "brain-injury-unit", item: "Acquired-brain-injury unit", label: "Acquired brain injury unit", more: true },
      { slug: "convalescence-unit", item: "Convalescence unit", label: "Convalescence unit", more: true },
      { slug: "transport", item: "Centre-provided bus/car transport", label: "The home's own bus or car", more: true },
    ],
  },
  {
    key: "act",
    param: "activity",
    list: "activities",
    title: "Activities",
    mode: "all",
    openByDefault: false,
    options: [
      { slug: "music", item: "Music and singing", label: "Music & singing" },
      { slug: "exercise", item: "Exercise classes", label: "Exercise classes" },
      { slug: "reminiscence", item: "Reminiscence activities", label: "Reminiscence", help: "Talking through memories with photos and objects" },
      { slug: "arts", item: "Arts and crafts", label: "Arts & crafts" },
      { slug: "outings", item: "Outings", label: "Outings" },
      { slug: "sensory", item: "Sensory activities", label: "Sensory sessions" },
      { slug: "pets", item: "Pet therapy", label: "Pet therapy" },
      { slug: "gardening", item: "Gardening and flower arranging", label: "Gardening" },
      { slug: "dancing", item: "Dancing", label: "Dancing", more: true },
      { slug: "drama", item: "Drama and performances", label: "Drama & performances", more: true },
      { slug: "knitting", item: "Knitting and sewing", label: "Knitting & sewing", more: true },
      { slug: "cooking", item: "Cooking and baking", label: "Cooking & baking", more: true },
      { slug: "bingo", item: "Bingo", label: "Bingo", more: true },
      { slug: "quizzes", item: "Quizzes and word games", label: "Quizzes & word games", more: true },
      { slug: "board-games", item: "Board and card games", label: "Board & card games", more: true },
      { slug: "ball-games", item: "Ball and movement games", label: "Ball & movement games", more: true },
      { slug: "reading", item: "Reading and writing", label: "Reading & writing", more: true },
      { slug: "talks", item: "Talks and discussion groups", label: "Talks & discussion groups", more: true },
      { slug: "walking", item: "Walking", label: "Walking", more: true },
      { slug: "socials", item: "Social gatherings and celebrations", label: "Social gatherings & celebrations", more: true },
      { slug: "mens-groups", item: "Men’s groups", label: "Men’s groups", more: true },
      { slug: "films", item: "Films and television", label: "Films & television", more: true },
      { slug: "radio", item: "Radio", label: "Radio", more: true },
      { slug: "cst", item: "Cognitive stimulation therapy", label: "Cognitive stimulation therapy", more: true },
      { slug: "sonas", item: "Sonas", label: "Sonas", more: true },
      { slug: "physiotherapy", item: "Physiotherapy", label: "Physiotherapy", more: true },
      { slug: "occupational-therapy", item: "Occupational therapy", label: "Occupational therapy", more: true },
      { slug: "music-therapy", item: "Music therapy", label: "Music therapy", more: true },
      { slug: "art-therapy", item: "Art therapy", label: "Art therapy", more: true },
      { slug: "aromatherapy", item: "Aromatherapy", label: "Aromatherapy", more: true },
      { slug: "meditation", item: "Meditation and relaxation", label: "Meditation & relaxation", more: true },
      { slug: "hairdressing", item: "Hairdressing", label: "Hairdressing", more: true },
      { slug: "beauty", item: "Beauty and nail care", label: "Beauty & nail care", more: true },
      { slug: "massage", item: "Massage", label: "Massage", more: true },
      { slug: "religious-services", item: "Religious services and prayer", label: "Religious services & prayer", more: true },
    ],
  },
];

// More options than this and the rest fold behind "Show all".
export const SHOWN_OPTIONS = 6;

export const SORTS = [
  { value: "name", label: "Name A–Z" },
  { value: "latest_inspection", label: "Latest inspection" },
] as const;

export type SortValue = (typeof SORTS)[number]["value"];

// What's ticked: each group's slugs, in the order of the options. There's no Fair Deal filter: 526 of
// the 547 homes have a contract price, so it would hardly filter anything. Each result still says
// "Fair Deal" from the home's fair_deal field.
export interface FilterSelection {
  care: string[];
  room: string[];
  fac: string[];
  act: string[];
}

export const NO_FILTERS: FilterSelection = { care: [], room: [], fac: [], act: [] };

type Params = Record<string, string | string[] | undefined>;

function values(params: Params, key: string) {
  const value = params[key];
  return (Array.isArray(value) ? value : value ? [value] : []).flatMap((entry) => entry.split(","));
}

// From the page address. Unknown slugs are dropped, so an old or mistyped link still works.
export function readSelection(params: Params): FilterSelection {
  const selection: FilterSelection = { ...NO_FILTERS };
  for (const group of FILTER_GROUPS) {
    const picked = new Set(values(params, group.key));
    selection[group.key] = group.options.filter((option) => picked.has(option.slug)).map((option) => option.slug);
  }
  return selection;
}

export function filterCount(selection: FilterSelection) {
  return FILTER_GROUPS.reduce((total, group) => total + selection[group.key].length, 0);
}

// For the page address: ?care=dementia,respite&fac=garden. Comma-joined, so a shared link stays short.
export function selectionParams(selection: FilterSelection) {
  const params = new URLSearchParams();
  for (const group of FILTER_GROUPS) {
    if (selection[group.key].length > 0) params.set(group.key, selection[group.key].join(","));
  }
  return params;
}

// For GET /centres: one parameter per ticked item (care_type=Dementia care&care_type=Respite care).
export function apiFilterParams(selection: FilterSelection) {
  const params = new URLSearchParams();
  for (const group of FILTER_GROUPS) {
    for (const slug of selection[group.key]) params.append(group.param, optionFor(group, slug)!.item);
  }
  return params;
}

export function optionFor(group: FilterGroup, slug: string) {
  return group.options.find((option) => option.slug === slug);
}

export function groupFor(key: FilterGroupKey) {
  return FILTER_GROUPS.find((group) => group.key === key)!;
}

// The selection with one option ticked or unticked.
export function toggled(selection: FilterSelection, key: FilterGroupKey, slug: string): FilterSelection {
  const group = groupFor(key);
  const picked = new Set(selection[key]);
  if (picked.has(slug)) picked.delete(slug);
  else picked.add(slug);
  return { ...selection, [key]: group.options.filter((option) => picked.has(option.slug)).map((option) => option.slug) };
}

// Each active filter, for the removable tags: its label, and the selection without it.
export function activeFilters(selection: FilterSelection) {
  const active: { id: string; label: string; without: FilterSelection }[] = [];
  for (const group of FILTER_GROUPS) {
    for (const slug of selection[group.key]) {
      const option = optionFor(group, slug)!;
      active.push({ id: `${group.key}-${slug}`, label: option.label, without: toggled(selection, group.key, slug) });
    }
  }
  return active;
}

// The selected options a home has, for the ticks on its card. Room types are "any of", so only the
// ones it has are shown.
export function matchedLabels(selection: FilterSelection, amenities: Record<FilterGroup["list"], string[]> | null | undefined) {
  if (!amenities) return [];
  return FILTER_GROUPS.flatMap((group) =>
    selection[group.key]
      .map((slug) => optionFor(group, slug)!)
      .filter((option) => amenities[group.list]?.includes(option.item))
      .map((option) => option.label),
  );
}
