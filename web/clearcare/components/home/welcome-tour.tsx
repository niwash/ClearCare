"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { TOUR_MENU_EVENT } from "@/components/layout/mobile-menu";
import { primaryButtonClass } from "@/components/ui/classes";

// The welcome tour (CCARE-164): a short walk around the site from the home page, pointing at one
// part at a time, in the order of the How to navigate ClearCare guide (/guides/using-clearcare).
// A first-time visitor is asked first ("New here?"), never started on it; "Take a quick tour"
// in the welcome band starts it again, and the guide links to /?tour, which starts it on arrival.
//
// It is a native modal <dialog>, like the leaving-site box: focus stays inside it, the page behind
// can't be used, and Escape skips. Each step's heading takes focus, so screen readers read it.
// Nothing moves on its own. Without JavaScript there is no tour and the button stays disabled,
// like the Easier to read button.

// Finishing or skipping is remembered on this device, so the offer isn't shown again.
const TOUR_STORAGE_KEY = "tour";

// Where a step points, found by its data-tour attribute. A step lists the places in order and
// shows the first one on screen: the navigation bar, or the Menu button where the bar is hidden
// (phones and tablets in the standard design). body replaces the step's words for that place.
// link is set on the Menu button's places: the menu is opened, highlighted with the button, and
// the link the step is about is ringed (CCARE-164: show that on a phone the links are there).
type Place = { selector: string; body?: ReactNode; link?: string };

export type TourStep = { title: string; body: ReactNode; places?: Place[] };

const MENU = '[data-tour="menu"]';
const MENU_LINKS = '[data-tour="menu-links"]';

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to ClearCare",
    body: "This short tour shows where things are on the site, in the order of our guide How to navigate ClearCare. You can skip it at any time.",
  },
  {
    title: "Make the site easier to read",
    body: (
      <>
        Select <strong>Easier to read</strong> for larger, stronger text and underlined links. The button beside it
        switches between light and dark. Your choice is remembered on this device.
      </>
    ),
    places: [{ selector: '[data-tour="display"]' }],
  },
  {
    title: "Start with our guides",
    body: (
      <>
        <strong>Resources</strong> has our guides. Start with How a Family Chooses a Nursing Home: it shows every
        step, from the first conversation to moving in.
      </>
    ),
    places: [
      { selector: '[data-tour="nav"] a[href="/resources"]' },
      {
        selector: MENU,
        link: "/resources",
        body: (
          <>
            On phones and tablets, the links are in this menu. Our guides are under <strong>Resources</strong>,
            starting with How a Family Chooses a Nursing Home.
          </>
        ),
      },
    ],
  },
  {
    title: "Learn how to pay for care",
    body: (
      <>
        <strong>Fair Deal</strong> explains the scheme that helps pay for nursing home care: who qualifies and how to
        apply.
      </>
    ),
    places: [
      { selector: '[data-tour="nav"] a[href="/guides/fair-deal"]' },
      {
        selector: MENU,
        link: "/guides/fair-deal",
        body: (
          <>
            <strong>Fair Deal</strong>, in this menu, explains the scheme that helps pay for nursing home care: who
            qualifies and how to apply.
          </>
        ),
      },
    ],
  },
  {
    title: "Search for a home",
    body: (
      <>
        <strong>Search for Homes</strong> finds a home by its name, Eircode, address or county. Each home’s page shows
        its inspection record and its phone number, so you can call and ask your questions, such as whether a bed is
        free. ClearCare doesn’t show free beds.
      </>
    ),
    // The navigation bar's link, on every page, rather than the search box on the home page.
    places: [
      { selector: '[data-tour="nav"] a[href="/search"]' },
      {
        selector: MENU,
        link: "/search",
        body: (
          <>
            {/* Shorter than on a computer: the menu leaves little room for the card on small phones. */}
            <strong>Search for Homes</strong>, in this menu, finds a home by name, Eircode, address or county. Each
            home’s page has its inspection record and phone number.
          </>
        ),
      },
    ],
  },
  {
    title: "Find who to contact",
    body: (
      <>
        <strong>Contacts</strong> lists HIQA, the Fair Deal offices, dementia services, and support and advocacy
        groups.
      </>
    ),
    places: [
      { selector: '[data-tour="nav"] a[href="/contacts"]' },
      {
        selector: MENU,
        link: "/contacts",
        body: (
          <>
            <strong>Contacts</strong>, in this menu, lists HIQA, the Fair Deal offices, dementia services, and support
            and advocacy groups.
          </>
        ),
      },
    ],
  },
  {
    title: "That’s the tour",
    body: (
      <>
        How to navigate ClearCare has these steps in writing, and you can take the tour again here. Lost? Select{" "}
        <strong>ClearCare</strong> at the top of any page.
      </>
    ),
    places: [{ selector: '[data-tour="guide-links"]' }],
  },
];

// The offer is shown until the tour is finished or skipped. If storage is blocked it isn't shown
// at all, rather than on every visit; seenHere covers storage that reads but won't save.
const listeners = new Set<() => void>();
let seenHere = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function tourSeen() {
  if (seenHere) return true;
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "done";
  } catch {
    return true;
  }
}

function markSeen() {
  seenHere = true;
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, "done");
  } catch {
    // Remembered until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

type Target = { element: HTMLElement; body?: ReactNode; link?: string };

// The first of a step's places that is on screen; a hidden element has no boxes.
function findTarget(step: TourStep): Target | null {
  for (const place of step.places ?? []) {
    const element = document.querySelector<HTMLElement>(place.selector);
    if (element && element.getClientRects().length > 0) return { element, body: place.body, link: place.link };
  }
  return null;
}

// The box around all the given elements that are on screen, such as the Menu button and its open
// menu.
function boundsOf(elements: (HTMLElement | null)[]): DOMRect | null {
  const rects = elements
    .filter((element): element is HTMLElement => !!element && element.getClientRects().length > 0)
    .map((element) => element.getBoundingClientRect());
  if (rects.length === 0) return null;
  const top = Math.min(...rects.map((rect) => rect.top));
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

// Space between the part and the highlight around it, and between the highlight and the card.
const PAD = 8;
const GAP = 12;
const EDGE = 16;

// The card goes below a part in the top half of the window and above one in the bottom half. On
// phones it fills the width at the bottom or top edge instead, away from the part. A step with
// nothing to point at sits in the middle.
function cardPosition(rect: DOMRect | null): CSSProperties {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!rect) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: Math.min(448, width - 2 * EDGE) };
  }
  const below = rect.top + rect.height / 2 < height / 2;
  if (width < 640) {
    // No taller than the space beside the highlight, so it never covers the part (such as the
    // open menu on a small phone); 12rem at least, so a big part can't squeeze it away.
    const space = below ? height - rect.bottom - PAD - GAP - EDGE : rect.top - PAD - GAP - EDGE;
    return { left: EDGE, right: EDGE, maxHeight: Math.max(space, 192), ...(below ? { bottom: EDGE } : { top: EDGE }) };
  }
  const cardWidth = Math.min(384, width - 2 * EDGE);
  const left = Math.min(Math.max(rect.left - PAD, EDGE), width - cardWidth - EDGE);
  return below
    ? { left, width: cardWidth, top: rect.bottom + PAD + GAP, maxHeight: height - rect.bottom - PAD - GAP - EDGE }
    : { left, width: cardWidth, bottom: height - rect.top + PAD + GAP, maxHeight: rect.top - PAD - GAP - EDGE };
}

// The highlight around the part, kept inside the window, so a part at the edge (such as the last
// link of the adult-centred design's sideways-scrolling menu on phones) is still ringed all round.
type Box = { top: number; left: number; width: number; height: number };

// The highlight's box as a path with corners rounded like rounded-lg (8px), cut out of the
// darkened window (fill-rule evenodd).
function holePath({ top, left, width, height }: Box) {
  const r = Math.min(8, width / 2, height / 2);
  return (
    `M${left + r} ${top}H${left + width - r}A${r} ${r} 0 0 1 ${left + width} ${top + r}` +
    `V${top + height - r}A${r} ${r} 0 0 1 ${left + width - r} ${top + height}` +
    `H${left + r}A${r} ${r} 0 0 1 ${left} ${top + height - r}V${top + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`
  );
}

function highlightPosition(rect: DOMRect, pad = PAD): Box {
  const inset = 4;
  const top = Math.max(rect.top - pad, inset);
  const left = Math.max(rect.left - pad, inset);
  const right = Math.min(rect.right + pad, window.innerWidth - inset);
  const bottom = Math.min(rect.bottom + pad, window.innerHeight - inset);
  return { top, left, width: right - left, height: bottom - top };
}

const outlineButtonClass =
  "inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 font-semibold text-ink no-underline hover:border-primary hover:text-ink";

// "Take a quick tour", for the welcome band, with the first-visit offer and the tour itself.
export function WelcomeTour() {
  // The server can't know whether the tour has been seen, so it renders without the offer.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const seen = useSyncExternalStore(subscribe, tourSeen, () => true);
  const [step, setStep] = useState<number | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [linkRect, setLinkRect] = useState<DOMRect | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  function go(index: number) {
    const found = findTarget(TOUR_STEPS[index]);
    setStep(index);
    setTarget(found);
    setRect(found ? found.element.getBoundingClientRect() : null);
  }

  function end() {
    markSeen();
    setStep(null);
    setTarget(null);
    setRect(null);
    setLinkRect(null);
  }

  // From the guide's "Take the tour" link, /?tour. The address is put back to / so a reload
  // doesn't start it again. Not cancelled on cleanup: in development React runs the effect twice,
  // and by the second run the address has no ?tour.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("tour")) return;
    window.history.replaceState(null, "", window.location.pathname);
    requestAnimationFrame(() => go(0));
  }, []);

  // Open and close the dialog with the tour. Afterwards focus goes back to "Take a quick tour",
  // also when the tour was started from the offer, which has gone by then.
  useEffect(() => {
    const box = dialog.current;
    if (!box) return;
    if (step !== null) {
      if (!box.open) box.showModal();
      opened.current = true;
      return;
    }
    if (box.open) box.close();
    if (opened.current) {
      opened.current = false;
      button.current?.focus();
    }
  }, [step]);

  // Bring the part into view and keep the highlight on it while the page scrolls or resizes.
  useEffect(() => {
    if (step === null) return;
    const element = target?.element ?? null;
    // Before scrolling: focus can stop a smooth scroll that has started.
    title.current?.focus({ preventScroll: true });
    // Smooth or instant, following the page's scroll-behavior (globals.css: reduced motion).
    // On phones, to the top (less its scroll-margin), leaving the rest of the screen for the card.
    element?.scrollIntoView({ block: window.innerWidth < 640 ? "start" : "center", inline: "nearest" });
    // On the Menu button, open the menu; the highlight takes it in once it shows (the observer).
    const menu = target?.link ? document.querySelector<HTMLElement>(MENU_LINKS) : null;
    const link = menu?.querySelector<HTMLElement>(`a[href="${target!.link}"]`) ?? null;
    if (menu) window.dispatchEvent(new CustomEvent(TOUR_MENU_EVENT, { detail: true }));
    let frame = 0;
    function measure() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // A resize can hide the part, such as the navigation bar giving way to the Menu button.
        if (element && element.getClientRects().length === 0) {
          setTarget(findTarget(TOUR_STEPS[step!]));
          return;
        }
        setRect(element ? boundsOf([element, menu]) : null);
        setLinkRect(boundsOf([link]));
      });
    }
    measure();
    const observer = new ResizeObserver(measure);
    if (menu) observer.observe(menu);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      // The next step opens it again if it needs it, in the same render, so it doesn't flicker.
      if (menu) window.dispatchEvent(new CustomEvent(TOUR_MENU_EVENT, { detail: false }));
    };
  }, [step, target]);

  const current = step === null ? null : TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  return (
    <>
      <button ref={button} type="button" onClick={() => go(0)} disabled={!hydrated} className={outlineButtonClass}>
        Take a quick tour
      </button>

      {/* Asked, not started (CCARE-164). In the bottom-left corner, clear of the Menu button. */}
      {!seen && step === null && (
        <section
          aria-labelledby="tour-offer-h"
          className="fixed bottom-4 left-4 right-24 z-30 flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-left text-ink shadow-xl sm:right-auto sm:w-96"
        >
          <h2 id="tour-offer-h" className="font-heading text-xl font-semibold">
            New here?
          </h2>
          <p>Take a quick tour to see where things are on ClearCare.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => go(0)} className={primaryButtonClass}>
              Start tour
            </button>
            <button type="button" onClick={markSeen} className={outlineButtonClass}>
              Skip tutorial
            </button>
          </div>
        </section>
      )}

      {/* The whole window, see-through: the highlight darkens everything around the part. A click
          outside the card does nothing, so a stray tap doesn't end the tour. */}
      <dialog
        ref={dialog}
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        onCancel={(event) => {
          event.preventDefault();
          end();
        }}
        onClose={() => step !== null && end()}
        className="m-0 h-full max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-left text-ink backdrop:bg-transparent"
      >
        {current && (
          <>
            {/* The window darkened, with a hole over the part. An SVG rather than a very wide
                shadow, which Edge can leave unpainted once the page has scrolled. */}
            <svg aria-hidden className="pointer-events-none fixed inset-0 size-full">
              <path fillRule="evenodd" fill="rgb(0 0 0 / 0.6)" d={`M0 0H99999V99999H0Z${rect ? holePath(highlightPosition(rect)) : ""}`} />
            </svg>
            {rect && (
              <div
                aria-hidden
                className="pointer-events-none fixed rounded-lg shadow-[0_0_0_3px_white,0_0_0_7px_var(--color-primary)]"
                style={highlightPosition(rect)}
              />
            )}
            {/* The link the step is about, inside the open menu. */}
            {linkRect && (
              <div
                aria-hidden
                className="pointer-events-none fixed rounded-md shadow-[0_0_0_3px_var(--color-primary)]"
                style={highlightPosition(linkRect, 4)}
              />
            )}

            <div
              style={cardPosition(rect)}
              className="fixed flex flex-col gap-2 overflow-y-auto rounded-lg border border-line bg-surface p-4 shadow-xl sm:gap-3 sm:p-5"
            >
              <p aria-hidden className="text-sm font-semibold text-ink-muted">
                Step {step! + 1} of {TOUR_STEPS.length}
              </p>
              {/* Focused so screen readers read each step, not to be used, so no outline. Inline,
                  as the adult-centred design's outline (globals.css) wins over utility classes. */}
              <h2
                id="tour-title"
                ref={title}
                tabIndex={-1}
                style={{ outline: "none" }}
                className="font-heading text-xl font-semibold md:text-2xl"
              >
                <span className="sr-only">
                  Step {step! + 1} of {TOUR_STEPS.length}:{" "}
                </span>
                {current.title}
              </h2>
              <p id="tour-body">{target?.body ?? current.body}</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                {/* Not on the last step, where Finish does the same. */}
                {!last && (
                  <button type="button" onClick={end} className="min-h-11 px-1 font-semibold text-ink underline hover:text-primary">
                    Skip tutorial
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  {step! > 0 && (
                    <button type="button" onClick={() => go(step! - 1)} className={outlineButtonClass}>
                      Back
                    </button>
                  )}
                  <button type="button" onClick={() => (last ? end() : go(step! + 1))} className={primaryButtonClass}>
                    {last ? "Finish" : "Next"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
