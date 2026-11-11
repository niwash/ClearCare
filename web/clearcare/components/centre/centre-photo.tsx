"use client";

// components/centre/centre-photo.tsx
// The home's photo, on the overview of its record (CCARE-209, ADR-0030). Google's Places UI Kit
// renders it in the visitor's browser from the listing the pipeline matched to the centre, so no
// image passes through our servers and none is stored.
//
// Nothing is asked of Google until the visitor says so. The request goes from their browser to
// Google and carries their IP address, so the frame shows a short note and a button first, and
// Google's library is not loaded until that button is pressed. The agreement lasts the visit, so a
// family reading several homes is asked once.
//
// A centre with no matched listing, a deployment without a browser key, or a refused request keeps
// the placeholder of the same size, so the layout never jumps and a family is never shown an empty
// frame. Only the photo and Google's attribution are shown: the page says the home's name, address
// and the rest itself, and repeating them inside Google's card would say everything twice.
import { APIProvider } from "@vis.gl/react-google-maps";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { primaryButtonClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";

// Module constant, so the loader's props keep their identity between renders: APIProvider reloads
// its libraries whenever they change. The Places library is what defines the UI Kit's elements.
const LIBRARIES = ["places"];

// The room a photo takes: 4:3 on its own, or the free height beside the details on wide screens
// (CCARE-212). The frame crops, so a real photo and the placeholder take the same room.
const FRAME = "aspect-[4/3] w-full overflow-hidden rounded-2xl adult:rounded-lg";

// Set once the visitor agrees, and kept for the visit like the welcome tour's dismissal: the same
// person moving between homes is not asked again, and closing the tab forgets it.
const AGREED_KEY = "photos-agreed";

function agreedAlready() {
  try {
    return sessionStorage.getItem(AGREED_KEY) === "yes";
  } catch {
    return false;
  }
}

function rememberAgreement() {
  try {
    sessionStorage.setItem(AGREED_KEY, "yes");
  } catch {
    // Not remembered, so the next home asks again. The photo still shows this time.
  }
}

// The agreement is read as an external store rather than copied into state in an effect: the server
// has no sessionStorage, and an effect that set state would both mismatch on hydration and trip
// React's rule against setting state in one. The event is how pressing the button tells this
// component, and the browser's own storage event is how another tab's agreement reaches it.
const AGREED_EVENT = "photos-agreed";

function subscribeToAgreement(onChange: () => void) {
  window.addEventListener(AGREED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(AGREED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function agreementNow() {
  return agreedAlready();
}

function agreementOnServer() {
  return false;
}

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
  const agreed = useSyncExternalStore(
    subscribeToAgreement,
    agreementNow,
    agreementOnServer,
  );
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  const ready = useCallback(() => setLoaded(true), []);
  const agree = useCallback(() => {
    rememberAgreement();
    window.dispatchEvent(new Event(AGREED_EVENT));
  }, []);

  if (!placeId || !apiKey) {
    return <Placeholder className={`${FRAME} ${className}`} />;
  }
  if (!agreed) {
    return <Consent className={`${FRAME} ${className}`} onAgree={agree} />;
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

// What the frame shows before anything is asked of Google. Short and plain: the photo is a nice
// extra, not a condition of using the page, and the wording should not make it sound like a risk.
function Consent({
  className = "",
  onAgree,
}: {
  className?: string;
  onAgree: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 border border-dashed border-line bg-surface-muted p-4 text-center ${className}`}
    >
      <Icon name="home" className="size-10 text-ink-muted" />
      <p className="text-sm font-semibold text-ink">
        Photos of this home come from Google
      </p>
      <p className="text-sm text-ink-muted">
        Showing them sends Google your IP address, as any visit to another site
        does.
      </p>
      <button
        type="button"
        onClick={onAgree}
        className={`${primaryButtonClass} mt-1 text-sm`}
      >
        Show photos
      </button>
      <a href="/privacy" className="text-xs text-ink-muted underline">
        Privacy notice
      </a>
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
