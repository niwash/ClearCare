"use client";

// components/search/place-box.tsx
// The "Town, area or Eircode" box in the search filters (CCARE-228), with "Use my location" under it.
// As the visitor types, Google suggests places in Ireland in a list under the box, a combobox by the
// ARIA pattern (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). What a pick, the typing and the
// location button do to the search is in lib/place-search.ts; like every field in the filters, it
// changes the draft, which applies on the panel's button.
//
// Without a key, before scripts run, or once Google has failed to load, the box is the plain text box
// it was before, searched as an address or Eircode. The location button needs no Google, so it is
// there whenever scripts run.
import { textInputClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";
import { nearFrom } from "@/lib/near";
import type { PageSearch } from "@/lib/page-search";
import { asksGoogle, pickedCounty, pickedPlace, typedPlace, usedLocation, type PendingPick, type PlaceSuggestion } from "@/lib/place-search";
import { MAX_TEXT_LENGTH } from "@/lib/search";
import { useEffect, useRef, useState, useSyncExternalStore, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";

import { GoogleMapsLogo } from "./google-maps-logo";
import type { GooglePlaces } from "./google-places";

type Draft = Pick<PageSearch, "name" | "place" | "near" | "county" | "selection" | "sort" | "view">;

// How long after the last character Google is asked, so a word typed at speed is one request.
const PAUSE = 250;
// The point is rounded to about 1 km (lib/near.ts), so a rough fix from the network is enough, and
// quicker and lighter on a phone's battery than GPS; one from the last five minutes will do.
const LOCATION_OPTIONS: PositionOptions = { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 };
const LOCATION_LIMIT = 10 * 1000;

type LocationState = "idle" | "asking" | "waiting" | "refused" | "timeout" | "unavailable" | "unsupported";

const LOCATION_MESSAGES: Record<LocationState, string> = {
  idle: "",
  asking: "Allow location access in your browser.",
  waiting: "Finding your location…",
  refused: "Location access is blocked.",
  timeout: "That took too long. Try again.",
  unavailable: "Couldn't find your location.",
  unsupported: "This browser can't share a location.",
};

// False on the server and in the first render in the browser, then true: the combobox and the
// location button need scripts, so they appear only once scripts run.
const subscribeNothing = () => () => {};

export function PlaceBox({
  id,
  draft,
  onChange,
  google,
  onPick,
}: {
  id: string;
  draft: Draft;
  onChange: Dispatch<SetStateAction<Draft>>;
  google: GooglePlaces;
  onPick: (pick: PendingPick) => void; // a picked place whose location is still on its way
}) {
  const scripted = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const combobox = scripted && google.enabled;
  const listId = `${id}-suggestions`;

  // What the visitor typed, which the suggestions are for. Not the box's text: a pick, or the page
  // address changing, puts text there that nobody typed.
  const [typed, setTyped] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
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
    if (!finder || !asksGoogle(typed)) return;
    let current = true;
    const timer = setTimeout(async () => {
      // Not once the box has lost focus, as it does to the Search button: the list couldn't open,
      // and a request now would open a session that nothing closes.
      if (document.activeElement !== input.current) return;
      const found = await finder.suggest(typed.trim()).catch(() => []);
      if (!current) return;
      setSuggestions(found);
      setActive(-1);
      setOpen(found.length > 0 && document.activeElement === input.current && dismissed.current !== typed);
    }, PAUSE);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [finder, typed]);

  // Only for the text in the box: "Clear all", a pick or the page address changing replace it.
  const offered = combobox && suggestions.length > 0 && asksGoogle(typed) && typed === draft.place;
  const shown = open && offered;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function type(text: string) {
    onChange((current) => typedPlace(current, text));
    setLocation("idle");
    locating.current += 1;
    // The list stays until the answer for the new text, but what was highlighted was for the old one.
    setActive(-1);
    if (!combobox) return;
    google.request();
    setTyped(text);
    if (!asksGoogle(text)) close();
  }

  function pick(suggestion: PlaceSuggestion) {
    locating.current += 1;
    close();
    setTyped("");
    setSuggestions([]);
    if (suggestion.county) {
      const county = suggestion.county;
      onChange((current) => pickedCounty(current, county));
      return;
    }
    const { label } = suggestion;
    onChange((current) => typedPlace(current, label));
    const near = suggestion.locate().catch(() => "");
    onPick({ label, near });
    near.then((point) => {
      // Unless the box has been edited since, or the search has moved on.
      if (point) onChange((current) => (current.place === label && !current.near ? pickedPlace(current, label, point) : current));
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !(shown && active >= 0)) {
      // Searches. Search looks the text up itself (settlePlace), so the request still waiting out the
      // pause is dropped: it would open a session that nothing closes.
      setTyped("");
      close();
      return;
    }
    if (!offered) return;
    const last = suggestions.length - 1;
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
      pick(suggestions[active]);
    } else if (event.key === "Escape" && shown) {
      // Closes the list, rather than emptying the box as a search box does on Escape.
      event.preventDefault();
      dismissed.current = typed;
      close();
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocation("unsupported");
      return;
    }
    close();
    const attempt = ++locating.current;
    // input is null once the box has gone, as it does when the phone's sheet closes.
    const wanted = () => attempt === locating.current && input.current !== null;
    let answered = false;
    let limit: ReturnType<typeof setTimeout> | undefined;
    const startLimit = () => {
      if (answered || !wanted()) return;
      setLocation("waiting");
      limit = setTimeout(() => {
        if (!wanted()) return;
        locating.current += 1;
        setLocation("timeout");
      }, LOCATION_LIMIT);
    };
    navigator.geolocation.getCurrentPosition(
      (position) => {
        answered = true;
        clearTimeout(limit);
        if (!wanted()) return;
        // Rounded here, before it is kept anywhere: nothing finer leaves the page.
        const near = nearFrom(position.coords.latitude, position.coords.longitude);
        if (!near) return setLocation("unavailable");
        onChange((current) => usedLocation(current, near));
        setTyped("");
        setLocation("idle");
      },
      (error) => {
        answered = true;
        clearTimeout(limit);
        if (wanted()) setLocation(error.code === error.PERMISSION_DENIED ? "refused" : "unavailable");
      },
      LOCATION_OPTIONS,
    );
    // The browser counts its own timeout from the call, including the time its question waits for
    // an answer, so the page keeps its own limit and starts it once the location is allowed. Without
    // the Permissions API it can't tell, and counts from the press.
    if (!navigator.permissions) return startLimit();
    navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (permission.state === "granted") return startLimit();
      if (permission.state === "prompt" && !answered && wanted()) setLocation("asking");
      permission.addEventListener("change", () => {
        if (permission.state === "granted") startLimit();
      });
    }, startLimit);
  }

  // A point with no name for it: from the button, or from a shared link with near and no place.
  // "A location", not "your location": whoever opens a shared link sees the sender's.
  const nameless = draft.near !== "" && draft.place === "";

  return (
    <div className="flex flex-col">
      <div className="relative">
        <Icon name="address" className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-ink-muted" />
        <input
          ref={input}
          id={id}
          name="place"
          type="search"
          value={draft.place}
          onChange={(event) => type(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={close}
          maxLength={MAX_TEXT_LENGTH}
          // The browser's own postcode list would cover Google's.
          autoComplete={combobox ? "off" : "postal-code"}
          role={combobox ? "combobox" : undefined}
          aria-autocomplete={combobox ? "list" : undefined}
          aria-expanded={combobox ? shown : undefined}
          aria-controls={combobox ? listId : undefined}
          aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
          className={`${textInputClass} w-full pl-10`}
        />

        {combobox && (
          // Google's attribution sits inside the list's own box, under the suggestions, as its
          // policies ask when there is no Google map.
          <div
            hidden={!shown}
            className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-lg adult:rounded-md"
          >
            <ul id={listId} role="listbox" aria-label="Suggested places">
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${index}-${suggestion.label}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  // Keeps the focus in the box, so a click picks without closing the list first.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(suggestion)}
                  className={`flex min-h-11 cursor-pointer items-center px-3 py-2 leading-snug ${index === active ? "bg-tint-blue text-on-tint-blue adult:bg-primary adult:text-on-primary" : "text-ink hover:bg-surface-muted"}`}
                >
                  {suggestion.label}
                </li>
              ))}
            </ul>
            {/* The clear space Google asks for round its logo: 10 px left, right and top, 5 below. */}
            <div className="border-t border-line-soft px-2.5 pb-[5px] pt-2.5">
              <GoogleMapsLogo />
            </div>
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

      {/* One live region for the location: what the button is doing, then the point in use. Always
          there, and empty when there is nothing to say, so what appears in it is announced. */}
      <div aria-live="polite" className="text-sm text-ink-muted">
        {location !== "idle" ? (
          <p>{LOCATION_MESSAGES[location]}</p>
        ) : nameless ? (
          <p className="flex flex-wrap items-center gap-x-2">
            Using a location.
            <button type="button" onClick={() => onChange((current) => typedPlace(current, ""))} className="min-h-11 font-semibold text-primary underline">
              Remove<span className="sr-only"> the location</span>
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
