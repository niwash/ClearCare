"use client";

// components/search/google-places.tsx
// Google's suggestions for the place box (CCARE-228): Maps JavaScript with its places library,
// loaded with @vis.gl/react-google-maps, and the Place Autocomplete Data API's answers read into
// PlaceSuggestions (lib/place-search.ts). Nothing here runs until the visitor types in the box.
// SearchFilters mounts the loader then, beside the forms rather than around them, so loading never
// remounts the input being typed in.
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useState } from "react";

import { nearFrom } from "@/lib/near";
import { readSuggestion, type PlaceSuggestion } from "@/lib/place-search";

// Module constants, so the loader's props keep their identity between renders: APIProvider reloads
// its libraries whenever they change.
const LIBRARIES = ["places"];
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

type LoaderProps = Parameters<typeof GooglePlacesLoader>[0];

// Google for the place boxes of the column and the phone sheet, which edit the same draft. Nothing
// loads until request(); the caller then renders the loader with the props this gives it.
export function useGooglePlaces(apiKey: string | null): GooglePlaces & { loader: LoaderProps | null } {
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
    loader: apiKey && requested ? { apiKey, onLoad, onError } : null,
  };
}

// Loads the library and hands over a PlaceFinder. It draws nothing. The search's page address holds
// the name searched for and near, so Google is to get only the origin: authReferrerPolicy="origin"
// has Maps JavaScript check the key against the origin alone rather than the whole address.
// solutionChannel="" leaves out the usage label the package adds to every request.
export function GooglePlacesLoader({
  apiKey,
  onLoad,
  onError,
}: {
  apiKey: string;
  onLoad: (finder: PlaceFinder) => void;
  onError: () => void;
}) {
  return (
    <APIProvider apiKey={apiKey} libraries={LIBRARIES} authReferrerPolicy="origin" solutionChannel="" onError={onError}>
      <PlacesLibrary onLoad={onLoad} />
    </APIProvider>
  );
}

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
