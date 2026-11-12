"use client";

// components/search/search-box.tsx
// The search box in the search page's bar (CCARE-230): one box for a home's name, a town, an area or
// an Eircode, with "Use my location" under it. As the visitor types, a list under the box suggests the
// nursing homes whose name matches, from ClearCare's own data (/search/names), then places in
// Ireland, from Google: a combobox by the ARIA pattern
// (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), its list in two groups. What a pick, the
// typing and the location button do to the search is in lib/search-box.ts; like every field in the
// bar, it changes the draft, which applies on Search.
//
// Without a key, or once Google has failed to load, the list suggests homes only. Before scripts run
// the box is a plain text box sent as q, which the search page settles without Google
// (app/(site)/search/page.tsx). The location button needs no Google, so it is there whenever scripts
// run.
import { textInputClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";
import { nearFrom } from "@/lib/near";
import type { PageSearch } from "@/lib/page-search";
import { MAX_TEXT_LENGTH } from "@/lib/search";
import {
  asksGoogle,
  boxText,
  editedText,
  pickedCounty,
  pickedName,
  pickedPlace,
  typedText,
  usedLocation,
  withoutPlace,
  type PendingPick,
  type PlaceSuggestion,
} from "@/lib/search-box";
import { useEffect, useRef, useState, useSyncExternalStore, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";

import { GoogleMapsLogo } from "./google-maps-logo";
import type { GooglePlaces } from "./google-places";

type Draft = Pick<PageSearch, "name" | "place" | "near" | "county" | "selection" | "sort" | "view">;

// How long after the last character the suggestions are asked for, so a word typed at speed is one
// request.
const PAUSE = 250;
const NO_SUGGESTIONS: { homes: string[]; places: PlaceSuggestion[] } = { homes: [], places: [] };
// The point is rounded to about 1 km (lib/near.ts), so a rough fix from the network is enough, and
// quicker and lighter on a phone's battery than GPS; one from the last five minutes will do.
const LOCATION_OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 };
const LOCATION_LIMIT = 10 * 1000;
const groupHeadingClass = "px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-[0.08em] text-ink-muted";

export type LocationState = "idle" | "asking" | "waiting" | "refused" | "timeout" | "unavailable" | "unsupported";

export const LOCATION_MESSAGES: Record<LocationState, string> = {
  idle: "",
  asking: "Allow location access in your browser.",
  waiting: "Finding your location…",
  refused: "Location access is blocked.",
  timeout: "That took too long. Try again.",
  unavailable: "Couldn't find your location.",
  unsupported: "This browser can't share a location.",
};

// False on the server and in the first render in the browser, then true: the combobox and the
// location button need scripts, so they appear only once scripts run. The filters' "Show all" too.
const subscribeNothing = () => () => {};
export function useScripted() {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

// Asks the browser where the visitor is, for "Use my location" under the box and "Homes near me"
// before anything is searched (homes-near-me.tsx). wanted: whether this request's answer still
// counts. says: what the button is doing or why it couldn't, for the visitor. found: the point.
export function askLocation(wanted: () => boolean, says: (state: LocationState) => void, found: (near: string) => void) {
  if (!("geolocation" in navigator)) {
    says("unsupported");
    return;
  }
  // Answered, or given up on at the limit: nothing after that counts.
  let over = false;
  let limit: ReturnType<typeof setTimeout> | undefined;
  const startLimit = () => {
    if (over || !wanted()) return;
    says("waiting");
    limit = setTimeout(() => {
      if (!wanted()) return;
      over = true;
      says("timeout");
    }, LOCATION_LIMIT);
  };
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (over) return;
      over = true;
      clearTimeout(limit);
      if (!wanted()) return;
      // Rounded here, before it is kept anywhere: nothing finer leaves the page.
      const near = nearFrom(position.coords.latitude, position.coords.longitude);
      if (!near) return says("unavailable");
      found(near);
    },
    (error) => {
      if (over) return;
      over = true;
      clearTimeout(limit);
      if (wanted()) says(error.code === error.PERMISSION_DENIED ? "refused" : "unavailable");
    },
    LOCATION_OPTIONS,
  );
  // The browser counts its own timeout from the call, including the time its question waits for
  // an answer, so the page keeps its own limit and starts it once the location is allowed. Without
  // the Permissions API it can't tell, and counts from the press.
  if (!navigator.permissions) return startLimit();
  navigator.permissions.query({ name: "geolocation" }).then((permission) => {
    if (permission.state === "granted") return startLimit();
    if (permission.state === "prompt" && !over && wanted()) says("asking");
    permission.addEventListener("change", () => {
      if (permission.state === "granted") startLimit();
    });
  }, startLimit);
}

// The names of the homes that match text, read through the site's own server.
export async function homeNames(text: string): Promise<string[]> {
  const response = await fetch(`/search/names?${new URLSearchParams({ text })}`);
  if (!response.ok) throw new Error(`/search/names answered ${response.status}`);
  return (await response.json()).names;
}

export function SearchBox({
  id,
  draft,
  searched,
  onChange,
  google,
  onPick,
}: {
  id: string;
  draft: Draft;
  searched: Draft; // the search the page shows, which the box's text was drawn from
  onChange: Dispatch<SetStateAction<Draft>>;
  google: GooglePlaces;
  onPick: (pick: PendingPick) => void; // a picked place whose location is still on its way
}) {
  const scripted = useScripted();
  const listId = `${id}-suggestions`;

  // What the visitor typed, which the suggestions are for. Not the box's text: a pick, or the page
  // address changing, puts text there that nobody typed.
  const [typed, setTyped] = useState("");
  const [suggestions, setSuggestions] = useState(NO_SUGGESTIONS);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [location, setLocation] = useState<LocationState>("idle");
  const input = useRef<HTMLInputElement>(null);
  // The text whose list Escape closed, so its answer doesn't open it again.
  const dismissed = useRef<string | null>(null);
  // Moved on by each location request, edit and pick: only the latest request's answer counts.
  const locating = useRef(0);

  const { finder } = google;
  useEffect(() => {
    if (!asksGoogle(typed)) return;
    let current = true;
    const timer = setTimeout(async () => {
      // Not once the box has lost focus, as it does to the Search button: the list couldn't open,
      // and a request now would open a session with Google that nothing closes.
      if (document.activeElement !== input.current) return;
      const text = typed.trim();
      // Both asked together, so the list opens once with its two groups. The homes come alone
      // while Google's library is still loading, and for good without it.
      const [homes, places] = await Promise.all([
        homeNames(text).catch(() => []),
        finder ? finder.suggest(text).catch(() => []) : [],
      ]);
      if (!current) return;
      setSuggestions({ homes, places });
      setActive(-1);
      setOpen(homes.length + places.length > 0 && document.activeElement === input.current && dismissed.current !== typed);
    }, PAUSE);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [finder, typed]);

  // The list's options in the order it shows them, homes first: the arrow keys move through both
  // groups as one list.
  const options = [
    ...suggestions.homes.map((name) => ({ label: name, pick: () => pickHome(name) })),
    ...suggestions.places.map((place) => ({ label: place.label, pick: () => pickPlace(place) })),
  ];
  // Only for the text in the box: "Clear all", a pick or the page address changing replace it.
  const offered = scripted && options.length > 0 && asksGoogle(typed) && typed === draft.place;
  const shown = open && offered;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function type(text: string) {
    onChange((current) => editedText(current, text, searched));
    setLocation("idle");
    locating.current += 1;
    // The list stays until the answer for the new text, but what was highlighted was for the old one.
    setActive(-1);
    google.request();
    setTyped(text);
    if (!asksGoogle(text)) close();
  }

  function picked() {
    locating.current += 1;
    close();
    setTyped("");
    setSuggestions(NO_SUGGESTIONS);
  }

  function pickHome(name: string) {
    picked();
    onChange((current) => pickedName(current, name));
  }

  function pickPlace(suggestion: PlaceSuggestion) {
    picked();
    if (suggestion.county) {
      const county = suggestion.county;
      onChange((current) => pickedCounty(current, county));
      return;
    }
    const { label } = suggestion;
    onChange((current) => typedText(current, label));
    const near = suggestion.locate().catch(() => "");
    onPick({ label, near });
    near.then((point) => {
      // Unless the box has been edited since, or the search has moved on.
      if (point) onChange((current) => (current.place === label && !current.near ? pickedPlace(current, label, point) : current));
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !(shown && active >= 0)) {
      // Searches. Search settles the text itself (settleBox), so the request still waiting out the
      // pause is dropped: it would open a session with Google that nothing closes.
      setTyped("");
      close();
      return;
    }
    if (!offered) return;
    const last = options.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive(!open || active >= last ? 0 : active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive(!open || active <= 0 ? last : active - 1);
    } else if (event.key === "Enter" && shown && active >= 0) {
      // Picks rather than searching. Enter with nothing chosen searches, with the first suggestion.
      event.preventDefault();
      options[active].pick();
    } else if (event.key === "Escape" && shown) {
      // Closes the list, rather than emptying the box as a search box does on Escape.
      event.preventDefault();
      dismissed.current = typed;
      close();
    }
  }

  function locate() {
    close();
    const attempt = ++locating.current;
    // input is null once the box has gone, as it has when the page was left.
    const wanted = () => attempt === locating.current && input.current !== null;
    askLocation(wanted, setLocation, (near) => {
      onChange((current) => usedLocation(current, near));
      setTyped("");
      setLocation("idle");
    });
  }

  // What the box doesn't show of where the search looks, said under it. A point with no name for
  // it, from the button or from a shared link with near and no place: "a location", not "your
  // location", since whoever opens a shared link sees the sender's. Or the place of a link that
  // holds a name as well: the box shows the name, and nothing typed here makes such a search.
  const underBox =
    draft.near !== "" && draft.place === ""
      ? { text: "Using a location.", remove: "the location" }
      : draft.name !== "" && draft.place !== ""
        ? { text: draft.near ? `Searching from ${draft.place}.` : `Searching in “${draft.place}”.`, remove: "the place" }
        : null;

  const option = (index: number) => (
    <li
      key={`${index}-${options[index].label}`}
      id={`${listId}-${index}`}
      role="option"
      aria-selected={index === active}
      // Keeps the focus in the box, so a click picks without closing the list first.
      onMouseDown={(event) => event.preventDefault()}
      onClick={options[index].pick}
      className={`flex min-h-11 cursor-pointer items-center px-3 py-2 leading-snug ${index === active ? "bg-tint-blue text-on-tint-blue adult:bg-primary adult:text-on-primary" : "text-ink hover:bg-surface-muted"}`}
    >
      {options[index].label}
    </li>
  );
  const homeCount = suggestions.homes.length;

  return (
    <div className="flex flex-col">
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-ink-muted" />
        <input
          ref={input}
          id={id}
          // Read only when the form is sent without scripts (app/(site)/search/page.tsx).
          name="q"
          type="search"
          value={boxText(draft)}
          onChange={(event) => type(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={close}
          maxLength={MAX_TEXT_LENGTH}
          // The browser's own list would cover the suggestions.
          autoComplete="off"
          role={scripted ? "combobox" : undefined}
          aria-autocomplete={scripted ? "list" : undefined}
          aria-expanded={scripted ? shown : undefined}
          aria-controls={scripted ? listId : undefined}
          aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
          className={`${textInputClass} w-full pl-10`}
        />

        {scripted && (
          <div
            hidden={!shown}
            className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-lg adult:rounded-md"
          >
            {/* Each group under its heading; a group with nothing to suggest is left out. */}
            <div id={listId} role="listbox" aria-label="Suggestions">
              {homeCount > 0 && (
                <ul role="group" aria-labelledby={`${listId}-homes`}>
                  <li id={`${listId}-homes`} role="presentation" className={groupHeadingClass}>
                    Nursing homes
                  </li>
                  {suggestions.homes.map((_, index) => option(index))}
                </ul>
              )}
              {suggestions.places.length > 0 && (
                <ul role="group" aria-labelledby={`${listId}-places`} className={homeCount > 0 ? "border-t border-line-soft" : ""}>
                  <li id={`${listId}-places`} role="presentation" className={groupHeadingClass}>
                    Places
                  </li>
                  {suggestions.places.map((_, index) => option(homeCount + index))}
                </ul>
              )}
            </div>
            {/* Google's attribution sits inside the list's own box, under its suggestions, as its
                policies ask when there is no Google map. The clear space Google asks for round its
                logo: 10 px left, right and top, 5 below. */}
            {suggestions.places.length > 0 && (
              <div className="border-t border-line-soft px-2.5 pb-[5px] pt-2.5">
                <GoogleMapsLogo />
              </div>
            )}
          </div>
        )}
      </div>

      {scripted && (
        <button
          type="button"
          onClick={locate}
          className="mt-1 inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-primary underline"
        >
          <Icon name="location" className="size-[18px]" />
          Use my location
        </button>
      )}

      {/* One live region for the location: what the button is doing, then the point or place in
          use. Always there, and empty when there is nothing to say, so what appears in it is
          announced. */}
      <div aria-live="polite" className="text-sm text-ink-muted">
        {location !== "idle" ? (
          <p>{LOCATION_MESSAGES[location]}</p>
        ) : underBox ? (
          <p className="flex flex-wrap items-center gap-x-2">
            {underBox.text}
            <button type="button" onClick={() => onChange(withoutPlace)} className="min-h-11 font-semibold text-primary underline">
              Remove<span className="sr-only"> {underBox.remove}</span>
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
