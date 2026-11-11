"use client";

// components/search/google-places.tsx
// Google's suggestions for the place box (CCARE-228): Maps JavaScript with its places library,
// loaded with @vis.gl/react-google-maps, and the Place Autocomplete Data API's answers read into
// PlaceSuggestions (lib/place-search.ts). Nothing here runs until the visitor types in the box, or
// the page draws a map (CCARE-229), which needs Maps JavaScript too: of every home when the search
// page opens with nothing searched, and of a search's results once Map is chosen.
//
// Maps JavaScript loads once on a page, so the place boxes and the map share one loader
// (GoogleMapsLoader). It mounts when the first of them needs it, beside the forms and the results
// rather than around them, so loading never remounts the input being typed in. What the place boxes
// need of it is held above both (GoogleForSearch), since the boxes are in the filters and the loader
// is where the map is drawn.
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { nearFrom } from "@/lib/near";
import { readSuggestion, type PlaceSuggestion } from "@/lib/place-search";

// Towns (Cavan, Swords), city areas (Rathmines, Tallaght, Dublin 6), counties and full Eircodes, and
// no streets or businesses; five is Google's limit. "(regions)" misses Rathmines and Dublin 6.
const PLACE_TYPES = ["locality", "neighborhood", "postal_town", "postal_code", "administrative_area_level_2"];

export interface PlaceFinder {
  suggest: (text: string) => Promise<PlaceSuggestion[]>;
}

export interface GooglePlaces {
  enabled: boolean; // there is a key and Google hasn't failed to load: the box offers suggestions
  inUse: boolean; // and the visitor has typed in it, so Search looks text up (settlePlace)
  finder: PlaceFinder | null; // once the library has loaded
  request: () => void; // on the first character typed
  // Google's first suggestion for text, once the library has loaded; null when there is none or it
  // failed to load.
  findFirst: (text: string) => Promise<PlaceSuggestion | null>;
}

// What the loader needs: the key, and whether a place box has asked for suggestions yet.
interface Loading {
  apiKey: string;
  placesWanted: boolean;
  onPlaces: (finder: PlaceFinder) => void;
  onError: () => void;
}

const Google = createContext<(GooglePlaces & { loading: Loading | null }) | null>(null);

// Around the filters and the results. apiKey is the browser key the page read on the server (not
// NEXT_PUBLIC_, so the Docker image doesn't carry it); null leaves the place box a plain text box
// and the page without a map.
export function GoogleForSearch({ apiKey, children }: { apiKey: string | null; children: ReactNode }) {
  return <Google.Provider value={useGoogle(apiKey)}>{children}</Google.Provider>;
}

// Google for the place boxes of the column and the phone sheet, which edit the same draft.
export function useGooglePlaces(): GooglePlaces {
  const google = useContext(Google);
  if (!google) throw new Error("useGooglePlaces needs GoogleForSearch around it");
  return google;
}

// Nothing loads for the place boxes until request().
function useGoogle(apiKey: string | null): GooglePlaces & { loading: Loading | null } {
  const [requested, setRequested] = useState(false);
  const [finder, setFinder] = useState<PlaceFinder | null>(null);
  const [failed, setFailed] = useState(false);
  // Settled once the library has loaded or failed, so a search sent while it loads can wait for it.
  const [ready] = useState(() => {
    let settle: (finder: PlaceFinder | null) => void = () => {};
    const promise = new Promise<PlaceFinder | null>((resolve) => (settle = resolve));
    return { promise, settle };
  });

  const onLoad = useCallback(
    (loaded: PlaceFinder) => {
      setFinder(loaded);
      ready.settle(loaded);
    },
    [ready],
  );
  const onError = useCallback(() => {
    setFailed(true);
    ready.settle(null);
  }, [ready]);
  const request = useCallback(() => setRequested(true), []);
  const findFirst = useCallback(
    async (text: string) => {
      const loaded = await ready.promise;
      return loaded ? ((await loaded.suggest(text))[0] ?? null) : null;
    },
    [ready],
  );

  return {
    enabled: Boolean(apiKey) && !failed,
    inUse: Boolean(apiKey) && requested && !failed,
    finder,
    request,
    findFirst,
    loading: apiKey ? { apiKey, placesWanted: requested, onPlaces: onLoad, onError } : null,
  };
}

// The page's one loader of Maps JavaScript. It mounts once a place box has asked for suggestions or
// it is given a map to draw, and then stays: the places library joins a loader the map started, and
// a map opened later is drawn in the one the place box started. Each library is fetched when
// something first uses it, so the map alone loads no places library.
//
// The search's page address holds the name searched for and near, so Google is to get only the
// origin: authReferrerPolicy="origin" has Maps JavaScript check the key against the origin alone
// rather than the whole address. solutionChannel="" leaves out the usage label the package adds to
// every request.
export function GoogleMapsLoader({ children }: { children?: ReactNode }) {
  const loading = useContext(Google)?.loading;
  if (!loading || !(loading.placesWanted || children)) return null;
  return (
    <APIProvider apiKey={loading.apiKey} authReferrerPolicy="origin" solutionChannel="" onError={loading.onError}>
      {loading.placesWanted && <PlacesLibrary onLoad={loading.onPlaces} />}
      {children}
    </APIProvider>
  );
}

// Loads the places library and hands over a PlaceFinder. It draws nothing.
function PlacesLibrary({ onLoad }: { onLoad: (finder: PlaceFinder) => void }) {
  const places = useMapsLibrary("places");
  useEffect(() => {
    if (places) onLoad(placeFinder(places));
  }, [places, onLoad]);
  return null;
}

// One autocomplete session for each place looked for, as Google bills them: the requests share a
// token until a suggestion is located, which ends the session, and the next request starts another.
function placeFinder(places: google.maps.PlacesLibrary): PlaceFinder {
  let session = new places.AutocompleteSessionToken();

  return {
    async suggest(text) {
      const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: text,
        includedRegionCodes: ["ie"],
        includedPrimaryTypes: PLACE_TYPES,
        sessionToken: session,
      });
      return suggestions.flatMap(({ placePrediction: prediction }) => {
        if (!prediction) return [];
        const read = readSuggestion({
          mainText: prediction.mainText?.text ?? prediction.text.text,
          secondaryText: prediction.secondaryText?.text ?? "",
        });
        return [
          {
            ...read,
            async locate() {
              const place = prediction.toPlace();
              session = new places.AutocompleteSessionToken();
              // The location only: it is all the search needs.
              await place.fetchFields({ fields: ["location"] });
              return place.location ? nearFrom(place.location.lat(), place.location.lng()) : "";
            },
          },
        ];
      });
    },
  };
}
