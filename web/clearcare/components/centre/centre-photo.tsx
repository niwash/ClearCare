"use client";

// components/centre/centre-photo.tsx
// The home's photo, on the overview of its record (CCARE-209, ADR-0030). Google's Places UI Kit
// renders it in the visitor's browser from the listing the pipeline matched to the centre, so no
// image passes through our servers and none is stored. A centre with no matched listing, a
// deployment without a browser key, or a refused request keeps the placeholder of the same size,
// so the layout never jumps and a family is never shown an empty frame.
//
// Only the photo and Google's attribution are shown: the page says the home's name, address and
// the rest itself, and repeating them inside Google's card would say everything twice.
import { APIProvider } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icons";

// Module constant, so the loader's props keep their identity between renders: APIProvider reloads
// its libraries whenever they change. The Places library is what defines the UI Kit's elements.
const LIBRARIES = ["places"];

// The room a photo takes: 4:3 on its own, or the free height beside the details on wide screens
// (CCARE-212). The frame crops, so a real photo and the placeholder take the same room.
const FRAME = "aspect-[4/3] w-full overflow-hidden rounded-2xl adult:rounded-lg";

export function CentrePhoto({
  placeId,
  apiKey,
  className = "",
}: {
  // Google's identifier for the centre's listing, or null when none was matched.
  placeId: string | null;
  // The browser key. Without one Google's library cannot load, so the placeholder stays.
  apiKey: string | null;
  className?: string;
}) {
  // Until the photo has loaded the placeholder is what shows; a refusal keeps it for good.
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  const ready = useCallback(() => setLoaded(true), []);

  if (!placeId || !apiKey) {
    return <Placeholder className={`${FRAME} ${className}`} />;
  }
  return (
    <div className={`${FRAME} ${className} relative`}>
      {!loaded && <Placeholder className="absolute inset-0" />}
      {/* Kept mounted while it loads, so it can report both success and failure; hidden until it
          has something to show. A refused key does not always raise an event, so waiting for
          gmp-load rather than for an error is what keeps the frame from going empty. */}
      {!failed && (
        <div className={loaded ? "h-full w-full" : "h-full w-full opacity-0"}>
          <APIProvider
            apiKey={apiKey}
            libraries={LIBRARIES}
            authReferrerPolicy="origin"
            solutionChannel=""
            onError={fail}
          >
            <GooglePhoto placeId={placeId} onError={fail} onLoad={ready} />
          </APIProvider>
        </div>
      )}
    </div>
  );
}

// Google's photo, once there is a listing to ask for. The element asks for the place itself; the
// key and the library were loaded by the provider above it.
function GooglePhoto({
  placeId,
  onError,
  onLoad,
}: {
  placeId: string;
  onError: () => void;
  onLoad: () => void;
}) {
  const element = useRef<google.maps.places.PlaceDetailsElement | null>(null);

  // Google reports on the element rather than throwing.
  useEffect(() => {
    const widget = element.current;
    if (!widget) return;
    widget.addEventListener("gmp-requesterror", onError);
    widget.addEventListener("gmp-load", onLoad);
    return () => {
      widget.removeEventListener("gmp-requesterror", onError);
      widget.removeEventListener("gmp-load", onLoad);
    };
  }, [onError, onLoad]);

  return (
    <gmp-place-details ref={element} className="centre-photo">
      <gmp-place-details-place-request place={placeId} />
      {/* Google's own card, media and attribution only: the content elements are asked for as
          siblings, which is the form that renders in this version of the library. Wrapping them
          in gmp-place-content-config leaves the element with no size and no content. */}
      <gmp-place-media lightbox-preferred />
      <gmp-place-attribution />
    </gmp-place-details>
  );
}

// Not an image yet, so nothing for screen readers to describe: the words say what is missing. It
// is a fact, not a promise: a home Google does not list will never have a photo here.
function Placeholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 border border-dashed border-line bg-surface-muted p-4 text-center text-ink-muted ${className}`}
    >
      <Icon name="home" className="size-10" />
      <p className="text-sm">No photo of this home yet</p>
    </div>
  );
}
