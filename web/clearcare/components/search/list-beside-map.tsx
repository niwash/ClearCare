"use client";

// components/search/list-beside-map.tsx
// The list of a search's results with the map beside it, on a wide screen (CCARE-230): what the two
// tell each other, and where the map is drawn. The card pointed at in the list marks its pin on the
// map, and the pin pressed on the map marks its card in the list. On a narrower screen the page shows
// one or the other (view-switch.tsx), and nothing is marked.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { GoogleMapsLoader } from "./google-places";

// Tailwind's xl, from which the page's classes put the map beside the list
// (app/(site)/search/page.tsx): the list keeps the width its cards need, and the map has the rest.
const WIDE = "(min-width: 80rem)";

interface ListAndMap {
  pointedId: string | null; // the home whose card holds the pointer or the keyboard's focus
  point: Dispatch<SetStateAction<string | null>>;
  chosenId: string | null; // the home whose pin was pressed, and whose card the map shows
  press: object | null; // that press: another one for each time a pin is pressed, the same pin too
  choose: (centreId: string | null) => void;
}

const Shared = createContext<ListAndMap | null>(null);

// Around the results: the list and the map are apart in the page, and this is what they share.
export function ListBesideMap({ children }: { children: ReactNode }) {
  const [pointedId, point] = useState<string | null>(null);
  const [press, setPress] = useState<{ centreId: string } | null>(null);
  const choose = useCallback((centreId: string | null) => setPress(centreId ? { centreId } : null), []);
  const shared = useMemo(() => ({ pointedId, point, chosenId: press?.centreId ?? null, press, choose }), [pointedId, press, choose]);
  return <Shared.Provider value={shared}>{children}</Shared.Provider>;
}

export function useListBesideMap(): ListAndMap {
  const shared = useContext(Shared);
  if (!shared) throw new Error("useListBesideMap needs ListBesideMap around it");
  return shared;
}

// Round a result card. Pointing at the card, or moving the keyboard's focus into it, marks its pin.
// When its pin is the one pressed, the list scrolls as far as it takes to show the card, which is
// marked with an outline, not a colour of its own, and with a line for screen readers. That line is
// read when the list is, and nothing is announced: the map's card has already been read out.
export function ResultOnMap({ centreId, children }: { centreId: string; children: ReactNode }) {
  const { point, chosenId, press } = useListBesideMap();
  const chosen = chosenId === centreId;
  const card = useRef<HTMLDivElement>(null);

  // For each press, not only when the chosen home changes: the list may have been scrolled away
  // from the card since, and pressing its pin again brings it back.
  useEffect(() => {
    if (chosen) card.current?.scrollIntoView({ block: "nearest" });
  }, [chosen, press]);
  // A card can leave the list with the pointer still in it, as when the page is turned. Its pin's
  // mark goes with it.
  useEffect(() => () => point((pointed) => (pointed === centreId ? null : pointed)), [centreId, point]);

  return (
    <div
      ref={card}
      onPointerEnter={() => point(centreId)}
      onPointerLeave={() => point(null)}
      onFocus={() => point(centreId)}
      onBlur={() => point(null)}
      className={`scroll-my-6 rounded-2xl adult:rounded-lg ${chosen ? "outline-3 outline-offset-2 outline-primary" : ""}`}
    >
      {chosen && <p className="sr-only">Chosen on the map</p>}
      {children}
    </div>
  );
}

function subscribeWide(listener: () => void) {
  const wide = matchMedia(WIDE);
  wide.addEventListener("change", listener);
  return () => wide.removeEventListener("change", listener);
}

// Where the page's map is drawn, inside the page's one Google loader. Beside the list, the map is
// for wide screens only, and is drawn by the screen's width as the browser reads it. Hidden with CSS
// alone it would still load, and a narrow screen's list is to send Google nothing until Map is chosen
// (privacy page). everywhere: the map is all the page shows at any width, as before a search and
// with view=map.
export function MapWhereShown({ everywhere, children }: { everywhere: boolean; children?: ReactNode }) {
  const wide = useSyncExternalStore(
    subscribeWide,
    () => matchMedia(WIDE).matches,
    () => false,
  );
  return <GoogleMapsLoader>{(everywhere || wide) && children}</GoogleMapsLoader>;
}
