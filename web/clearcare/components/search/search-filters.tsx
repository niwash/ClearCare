"use client";

// The search page's bar (CCARE-230): the search box (SearchBox), then the county and the care and
// amenity filters (lib/search-filters.ts). From md up it runs across the page above the results,
// with two buttons that each open a panel under them: "Care types", and "More filters" for the room
// types, facilities and activities. On phones the bar is the box, and a "Filters" button opens the
// county and the four groups in a full-screen sheet. Either way, choices apply on "Show n nursing
// homes", Search or Enter, not as they're made, so the results don't change under someone still
// choosing. Until then the counts, and the number on the button, are asked for as choices change
// (/search/count). Every choice is in the page address, so a search can be shared as a link. The
// bar is a real form and its panels are <details>, so without scripts it still searches.
//
// The care and amenity groups need the counts (facets): when the API can't be read, they're left
// out rather than offered without them.
import { AmenityIcon } from "@/components/centre/amenity-icon";
import { Chevron } from "@/components/ui/chevron";
import { fullWidthClass, primaryButtonClass, textInputClass } from "@/components/ui/classes";
import { PreferencesNotice } from "@/components/preferences/preferences-notice";
import { SavePreferencesButton } from "@/components/preferences/save-preferences-button";
import { hydrateSavedSearch, savePreferences, type SavedSearchInitial } from "@/components/preferences/saved-search-store";
import { useGooglePlaces } from "@/components/search/google-places";
import { forgetLastSearch } from "@/components/search/last-search";
import { homeNames, SearchBox, useScripted } from "@/components/search/search-box";
import { filtersClearedHref, leavesHomesOut, searchHref, type PageSearch } from "@/lib/page-search";
import { savedSearchFrom } from "@/lib/preferences";
import { ANY_COUNTY, COUNTIES, type Facets } from "@/lib/search";
import { needsLookup, settleBox, typedText, withoutDistance, type PendingPick } from "@/lib/search-box";
import {
  CARE_GROUPS,
  filterCount,
  FILTER_GROUPS,
  MORE_GROUPS,
  NO_FILTERS,
  optionFor,
  SHOWN_OPTIONS,
  SORTS,
  toggled,
  withoutGroups,
  type FilterGroup,
  type FilterOption,
} from "@/lib/search-filters";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useRef, useState, useTransition, type ReactNode } from "react";

// view is not a filter, but it is in the page address with them, so the draft carries it and a new
// search keeps the list or the map the visitor was on.
type FilterState = Pick<PageSearch, "name" | "place" | "near" | "county" | "selection" | "sort" | "view">;

const EMPTY: FilterState = { name: "", place: "", near: "", county: "", selection: NO_FILTERS, sort: "name", view: "list" };
// How long after the last change its counts are asked for.
const PAUSE = 250;
// How long Search waits for the homes' names and for Google to settle the box's text before
// searching it as a name.
const LOOKUP_LIMIT = 2000;

function noun(count: number) {
  return count === 1 ? "nursing home" : "nursing homes";
}

export function SearchFilters({
  search,
  facets,
  total,
  sortShown,
  initialSaved,
  arrivedWith,
}: {
  search: FilterState;
  facets: Facets | null;
  total: number | null; // null before anything is searched for
  sortShown: boolean;
  // What the page read from the account on the server (ADR-0025): whether there is a saved search,
  // and whether one could be read at all. Handed down rather than fetched here, so a visitor with no
  // account sends no request, and the page has already opened a kept search before it renders.
  initialSaved: SavedSearchInitial;
  // Text from the home page box that the server left for the browser to settle, which can ask
  // Google where a town is (app/(site)/search/page.tsx); null on any other arrival.
  arrivedWith: string | null;
}) {
  const router = useRouter();
  const id = useId();
  const [, startTransition] = useTransition();
  const applied = searchHref(search);

  // The choices not yet applied, in the bar or the sheet. They start as what's applied, and go
  // back to it whenever the page address changes (a search, a tag removed, the back button).
  const sheet = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<FilterState>(arrivedWith ? typedText(search, arrivedWith) : search);
  const [draftFor, setDraftFor] = useState(applied);
  if (draftFor !== applied) {
    setDraftFor(applied);
    setDraft(search);
  }
  const [fetched, setFetched] = useState<{ total: number | null; facets: Facets | null; search: FilterState } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Which of the bar's panels is open: one at a time, so neither covers the other.
  const [openPanel, setOpenPanel] = useState<"care" | "more" | null>(null);
  const draftHref = searchHref(draft);
  // What "Save my preferences" would keep, for whether it has anything to keep: the choices in the
  // form, not the words typed into the search box (lib/preferences.ts).
  const savedFromDraft = savedSearchFrom(draft);
  // Google's suggestions for the search box, loaded once the visitor types in it or arrives with
  // text from the home page box, and a picked place whose location Google is still giving, which
  // Search waits for.
  const google = useGooglePlaces();
  const pick = useRef<PendingPick | null>(null);
  // Counts presses of Search: a lookup can take up to LOOKUP_LIMIT, so an older press can finish last.
  const searches = useRef(0);
  // Text in the search box that Search will settle first: a count now would be for the wrong search.
  const lookingUp = needsLookup(draft, search);

  // The account's saved choices, as the page read them on the server. "Save my preferences"
  // reports them, and a kept search was applied before this page rendered (app/(site)/search),
  // so there is nothing to fetch and nothing to redirect from here.
  const { status: savedStatus, saved: savedAtLoad } = initialSaved;
  useEffect(() => {
    hydrateSavedSearch({ status: savedStatus, saved: savedAtLoad });
  }, [savedStatus, savedAtLoad]);

  // Forgetting empties the page as well as the account: the choices on screen are gone from the
  // table, so they should not stay in front of the visitor as if they were still kept. The sheet
  // closes too, so a phone is not left looking at an empty form.
  function startOver() {
    sheet.current?.close();
    setDraft({ ...EMPTY, sort: withoutDistance(draft.sort) });
    // The links to search would otherwise bring the forgotten choices back (CCARE-214).
    forgetLastSearch();
    startTransition(() => router.replace("/search"));
  }

  // The browser's Back button can restore this page from its own cache, without asking the server:
  // it comes back exactly as it was, including "Forget my preferences" for a search that has since
  // been forgotten. A restored page is loaded again, so what it shows is what is stored.
  //
  // router.refresh() is not enough here: on a restored page it is answered from the router's own
  // cache with the payload the page was built from, which is the stale one. Reloading asks the server.
  useEffect(() => {
    const askAgain = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", askAgain);
    return () => window.removeEventListener("pageshow", askAgain);
  }, []);
  // The page's own counts while the draft is what's applied; otherwise the last ones fetched for it,
  // which lag a moment behind the ticks. Each comes with the search it counts, which words the button.
  const draftCount = draftHref === applied || !fetched ? { total, facets, search } : fetched;

  useEffect(() => {
    if (draftHref === applied || lookingUp) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(draftHref.replace("/search", "/search/count"), { signal: controller.signal });
        if (response.ok) setFetched({ ...(await response.json()), search: draft });
      } catch {
        // Aborted by a newer change, or offline: the button keeps its last count.
      }
    }, PAUSE);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, draftHref, applied, lookingUp]);

  // What the sheet holds of the draft, as it was when the sheet opened.
  const openedWith = useRef({ county: draft.county, selection: draft.selection });

  function openSheet() {
    openedWith.current = { county: draft.county, selection: draft.selection };
    setSheetOpen(true);
    sheet.current?.showModal();
  }

  // Closing the sheet without "Show n nursing homes" drops what was chosen in it: Search in the bar
  // would otherwise apply choices nobody can see. Only that: the box is in the bar, so its text
  // stays, and so does a county picked from its suggestions before the sheet opened.
  function dismissSheet() {
    setDraft({ ...draft, ...openedWith.current });
    sheet.current?.close();
  }

  // The draft with the search box's text as the name, county or place it is (lib/search-box.ts),
  // or null once a later press of Search has taken over.
  async function settle() {
    const thisSearch = ++searches.current;
    const settled = await settleBox(draft, {
      searched: search,
      pick: pick.current,
      hasName: async (text) => (await homeNames(text)).length > 0,
      findFirst: google.findFirst,
      deadline: new Promise((resolve) => setTimeout(resolve, LOOKUP_LIMIT)),
    });
    return thisSearch === searches.current ? settled : null;
  }

  // A search with every field emptied goes to the page that says so (?filtersCleared=true) rather than to
  // /search, which is the arrival that opens the visitor's saved search again. Without this,
  // "Clear all" followed by Search would put the cleared filters straight back.
  function go(settled: FilterState, how: "push" | "replace" = "push") {
    startTransition(() => router[how](filtersClearedHref(settled), { scroll: false }));
  }

  async function apply() {
    sheet.current?.close();
    setOpenPanel(null);
    const settled = await settle();
    if (settled) go(settled);
  }

  // "Save my preferences" sits with the Search button, so it saves what is about to be searched
  // for, and applies it once stored. The text is settled first: typed in the box, a county is one
  // of the choices kept.
  async function save() {
    const settled = await settle();
    if (!settled) return false;
    return savePreferences(savedSearchFrom(settled), () => {
      sheet.current?.close();
      go(settled);
    });
  }

  // Text from the home page box goes through the rule Search follows, once the page is in the
  // browser. Until then the page is the one for nothing searched, with the text in the box. Its
  // search replaces this address, so Back leads to the home page and not to the settling again.
  const settleArrival = useEffectEvent(async () => {
    const settled = await settle();
    if (settled) go(settled, "replace");
  });
  useEffect(() => {
    if (arrivedWith) settleArrival();
  }, [arrivedWith]);

  // Worded from the search the count is for, so that until a new count arrives the button keeps
  // what it said. A point alone lists every home (leavesHomesOut), so the button doesn't count them.
  const counted = draftCount.search;
  const showLabel =
    draftCount.total === null || lookingUp
      ? "Search"
      : leavesHomesOut(counted)
        ? `Show ${draftCount.total} ${noun(draftCount.total)}`
        : counted.sort === "distance"
          ? "Show nearest nursing homes"
          : "Show nursing homes";

  // Something in the draft to clear (the order isn't cleared).
  const canClear = searchHref({ ...draft, sort: "name" }) !== "/search";
  const clear = () => setDraft({ ...EMPTY, sort: withoutDistance(draft.sort), view: draft.view });
  // One panel of the bar: how many of its groups' options are ticked, whether it is the open one,
  // and what its "Clear" empties.
  const panel = (key: "care" | "more", groups: FilterGroup[]) => ({
    count: filterCount(draft.selection, groups),
    open: openPanel === key,
    onOpenChange: (open: boolean) => setOpenPanel((current) => (open ? key : current === key ? null : current)),
    onClear: () => setDraft({ ...draft, selection: withoutGroups(draft.selection, groups) }),
    showLabel,
  });
  const groupProps = (group: FilterGroup, facets: Facets) => ({
    group,
    picked: draft.selection[group.key],
    counts: facets[group.param],
    onToggle: (slug: string) => setDraft({ ...draft, selection: toggled(draft.selection, group.key, slug) }),
  });

  // What the sheet holds of the search in use, for the number on its button. The box is beside it.
  const active = filterCount(search.selection) + (search.county ? 1 : 0);

  return (
    <>
      <PreferencesNotice />

      {/* The bar: a band the width of the window, flush under the page's heading. */}
      <form
        action="/search"
        method="GET"
        role="search"
        aria-label="Search nursing homes"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
        className={`${fullWidthClass} -mt-6 bg-surface md:-mt-8 md:border-b md:border-line`}
      >
        <div className="page-column flex flex-col gap-1.5 px-4 pb-1 pt-4 md:px-8 md:pb-4">
          {/* One box, so nobody has to know which box their words belong in (CCARE-230). Its label
              is in view over it and no field has a faded example: people read one as already filled
              in (CCARE-164). */}
          <label htmlFor={`${id}-box`} className="text-sm font-semibold">
            Nursing home name, town, area or Eircode
          </label>
          {/* Beside the box where there is room for a box wide enough to type in: on phones, where
              only Search is with it, and from xl up. Between the two, the controls are a row under it. */}
          <div className="flex items-start gap-x-3 gap-y-2 md:flex-col md:items-stretch xl:flex-row xl:items-start">
            <div className="min-w-0 flex-1 md:max-w-2xl md:flex-none xl:max-w-none xl:flex-1">
              <SearchBox
                id={`${id}-box`}
                draft={draft}
                searched={search}
                onChange={setDraft}
                google={google}
                onPick={(picked) => {
                  pick.current = picked;
                }}
              />
            </div>
            {/* relative: "More filters" opens against this, so its panel ends where the bar does. */}
            <div className="relative xl:flex-none">
              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden items-center gap-2 md:flex">
                  <label htmlFor={`${id}-county`} className="text-sm font-semibold">
                    County
                  </label>
                  <CountySelect id={`${id}-county`} county={draft.county} onChange={(county) => setDraft({ ...draft, county })} pill />
                </div>
                {draftCount.facets && (
                  <>
                    <BarPanel label="Care types" {...panel("care", CARE_GROUPS)} className="relative" panelClassName="left-0 w-[22rem]">
                      <FilterOptions idPrefix={id} titled {...groupProps(CARE_GROUPS[0], draftCount.facets)} />
                      <ReadFromReports className="pb-2 pt-1" />
                    </BarPanel>
                    {/* As wide as three columns want, and never wider than the bar: the page's
                        column less its padding. */}
                    <BarPanel
                      label="More filters"
                      {...panel("more", MORE_GROUPS)}
                      panelClassName="right-0 w-[60rem] max-w-[calc(min(100vw,var(--page-max))-4rem)]"
                    >
                      <div className="grid grid-cols-3 gap-x-5 lg:gap-x-8">
                        {MORE_GROUPS.map((group) => (
                          <div key={group.key}>
                            <FilterOptions idPrefix={id} titled {...groupProps(group, draftCount.facets!)} />
                          </div>
                        ))}
                      </div>
                      <ReadFromReports className="pb-2 pt-1" />
                    </BarPanel>
                  </>
                )}
                <button type="submit" className={primaryButtonClass}>
                  Search
                </button>
                {canClear && (
                  <button type="button" onClick={clear} className="hidden min-h-11 px-2 text-sm text-primary underline md:block">
                    Clear all
                  </button>
                )}
              </div>
              {/* With the Search button: the choices are made here, so this is where they are kept
                  (ADR-0025). It applies them once saved, so the results on screen are the ones the
                  account remembers. On phones it is in the sheet. */}
              <div className="hidden md:block">
                <SavePreferencesButton current={savedFromDraft} save={save} onForgotten={startOver} />
              </div>
            </div>
          </div>
          {draft.sort !== "name" && <input type="hidden" name="sort" value={draft.sort} />}
          {draft.view === "map" && <input type="hidden" name="view" value="map" />}
          {/* Read only when the form is sent as a form, which is when scripts don't run. The box sends
              its text beside the search it was drawn from, so that text nobody edited goes on as the
              search it was (editedText), and "scripts" tells the page not to leave the text for the
              browser to settle. */}
          {draft.name && <input type="hidden" name="name" value={draft.name} />}
          {draft.place && <input type="hidden" name="place" value={draft.place} />}
          {draft.near && <input type="hidden" name="near" value={draft.near} />}
          <input type="hidden" name="scripts" value="off" />
        </div>
      </form>

      {/* Below md: Filters and the order under the box, kept at the top while the results scroll. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-6 flex gap-2 border-b border-line bg-surface px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={openSheet}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-primary bg-surface px-4 font-bold text-primary adult:rounded-md"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="size-[18px]">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filters
          {active > 0 && (
            <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-on-primary">
              {active}
              <span className="sr-only"> set</span>
            </span>
          )}
        </button>
        {sortShown && <SortSelect search={search} compact />}
      </div>

      <dialog
        ref={sheet}
        aria-labelledby="sheet-h"
        onCancel={dismissSheet}
        onClose={() => setSheetOpen(false)}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-ink md:hidden"
      >
        {sheetOpen && (
          <div className="flex h-full flex-col">
            <div className="flex min-h-15 items-center gap-2 border-b border-line py-2 pl-5 pr-2">
              <h2 id="sheet-h" className="flex-1 text-xl font-bold">
                Filters
              </h2>
              {/* Of what the sheet holds: the box and its text are in the bar. */}
              <button
                type="button"
                onClick={() => setDraft({ ...draft, county: "", selection: NO_FILTERS })}
                className="min-h-11 px-2.5 text-[15px] text-primary underline"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={dismissSheet}
                aria-label="Close filters"
                className="inline-flex size-11 items-center justify-center rounded-full bg-surface-muted"
              >
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="size-[18px]">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FilterPanel state={draft} onChange={setDraft} facets={draftCount.facets} onSubmit={apply} />
            </div>
            <div className="border-t border-line bg-surface px-5 pb-5 pt-3 shadow-[0_-6px_16px_rgb(31_42_55/0.06)]">
              <button type="button" onClick={apply} className="min-h-13 w-full rounded-full bg-primary text-[17px] font-bold text-on-primary">
                {showLabel}
              </button>
              <div className="mt-2 w-full">
                <SavePreferencesButton current={savedFromDraft} save={save} onForgotten={startOver} />
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

// One of the bar's buttons with the panel it opens under it, from md up. A <details>, so it opens
// without scripts too. With them only one is open at a time, and Escape, a click elsewhere or the
// focus moving on closes it. Not a dialog: the page stays in reach, and Tab goes from the button
// into the panel and on to the next control in the bar. The button says how many of the panel's
// options are ticked, and the panel ends with "Clear" for them and the button that searches.
function BarPanel({
  label,
  count,
  open,
  onOpenChange,
  onClear,
  showLabel,
  className = "",
  panelClassName,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  showLabel: string;
  className?: string;
  panelClassName: string; // where the panel sits and how wide it is
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const button = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeFromOutside = useEffectEvent((event: PointerEvent) => {
    if (!details.current?.contains(event.target as Node)) onOpenChange(false);
  });

  useEffect(() => {
    // Closed with the focus still inside, by Escape or by the button that searches: the focus goes
    // back to the panel's button rather than nowhere.
    if (!open) {
      if (details.current?.contains(document.activeElement)) button.current?.focus();
      return;
    }
    // The panel can reach past the bottom of the window, as it opens or as "Show all" lengthens
    // it, so the page is scrolled just enough to keep all of it on screen.
    const kept = new ResizeObserver(() => panel.current?.scrollIntoView({ block: "nearest" }));
    kept.observe(panel.current!);
    document.addEventListener("pointerdown", closeFromOutside);
    return () => {
      kept.disconnect();
      document.removeEventListener("pointerdown", closeFromOutside);
    };
  }, [open]);

  return (
    <details
      ref={details}
      // Without scripts, the browser closes one panel as the other opens.
      name="bar-panel"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) onOpenChange(false);
      }}
      // Tab has moved on. A click is left to closeFromOutside: Safari doesn't move the focus to a
      // button or a checkbox that is clicked, so a click inside the panel has no relatedTarget.
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) onOpenChange(false);
      }}
      className={`opens-over hidden md:block ${className}`}
    >
      <summary
        ref={button}
        className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border px-4 font-semibold adult:rounded-md [&::-webkit-details-marker]:hidden ${
          open || count > 0 ? "border-primary bg-tint-blue text-on-tint-blue" : "border-field bg-surface text-ink hover:border-primary"
        }`}
      >
        <span>
          {label}
          {count > 0 && (
            <>
              <span aria-hidden> · </span>
              {count}
              <span className="sr-only"> selected</span>
            </>
          )}
        </span>
        <Chevron className={`size-4 ${open ? "-rotate-90" : "rotate-90"}`} />
      </summary>
      {/* No taller than the window, so that all of it can be on screen at once: the options scroll
          and the buttons stay under them. Below lg it stops above the round Menu button, which is
          fixed in the corner where the panel's own button would be (mobile-menu.tsx). */}
      <div
        ref={panel}
        className={`absolute top-full z-30 mt-2 flex max-h-[calc(100dvh-7rem)] scroll-mb-24 scroll-mt-3 flex-col rounded-2xl border border-line bg-surface shadow-lg lg:max-h-[calc(100dvh-1.5rem)] lg:scroll-mb-3 adult:rounded-lg ${panelClassName}`}
      >
        <div className="min-h-0 overflow-y-auto px-5 pt-4">{children}</div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <button type="button" onClick={onClear} className="min-h-11 px-2 text-sm text-primary underline">
            Clear
          </button>
          <button type="submit" aria-live="polite" className={primaryButtonClass}>
            {showLabel}
          </button>
        </div>
      </div>
    </details>
  );
}

// The sheet's form: the county, then the four groups, folding. Changing anything calls onChange;
// the caller decides when it applies.
function FilterPanel({
  state,
  onChange,
  facets,
  onSubmit,
}: {
  state: FilterState;
  onChange: (state: FilterState) => void;
  facets: Facets | null;
  onSubmit: () => void;
}) {
  const id = useId();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-4 px-5 pb-5 pt-4.5">
        <Field id={`${id}-county`} label="County">
          <CountySelect id={`${id}-county`} county={state.county} onChange={(county) => onChange({ ...state, county })} className="w-full" />
        </Field>
        {/* The sheet's button is outside the form: so Enter searches. */}
        <button type="submit" className="sr-only focus:not-sr-only focus:self-start focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary">
          Search
        </button>
      </div>

      {facets && (
        <>
          <div className="border-t border-line px-5 pb-1.5 pt-4.5">
            <SectionHeading>Care &amp; living</SectionHeading>
            <ReadFromReports className="mt-1.5" />
          </div>
          {FILTER_GROUPS.map((group) => (
            <FilterGroupSection
              key={group.key}
              idPrefix={id}
              group={group}
              picked={state.selection[group.key]}
              counts={facets[group.param]}
              onToggle={(slug) => onChange({ ...state, selection: toggled(state.selection, group.key, slug) })}
            />
          ))}
        </>
      )}
    </form>
  );
}

// Every care and amenity option is filled from the amenities an AI tool read from the reports
// (centre_amenities_v2), so wherever they are offered says so, as the result cards and the centre
// page do, and that a report which leaves something out is not saying the home lacks it.
function ReadFromReports({ className }: { className: string }) {
  return (
    <p className={`text-xs text-ink-muted ${className}`}>
      Read by an AI tool from each home&apos;s inspection report. Reports differ in what they mention, so a home may have something
      that is not listed for it.
    </p>
  );
}

function CountySelect({
  id,
  county,
  onChange,
  className = "",
  pill = false,
}: {
  id: string;
  county: string;
  onChange: (county: string) => void;
  className?: string;
  pill?: boolean; // in the bar, where it sits among the panels' buttons and looks like them
}) {
  return (
    <SelectFrame className={`${className} ${pill && county ? "text-on-tint-blue" : ""}`}>
      <select
        id={id}
        name="county"
        value={county || ANY_COUNTY}
        onChange={(event) => onChange(event.target.value === ANY_COUNTY ? "" : event.target.value)}
        className={`${textInputClass} ${selectClass} ${
          pill
            ? `rounded-full! pl-4 font-semibold hover:border-primary adult:rounded-md! ${county ? "border-primary bg-tint-blue text-on-tint-blue" : ""}`
            : ""
        }`}
      >
        <option value={ANY_COUNTY}>Any county</option>
        {COUNTIES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </SelectFrame>
  );
}

// A select with the site's own arrow. The browser's sits against the right edge whatever the
// padding, so it is taken away and a chevron is drawn where the buttons beside it have theirs.
const selectClass = "w-full appearance-none pr-9";

function SelectFrame({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`relative inline-flex text-ink ${className}`}>
      {children}
      <Chevron className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90" />
    </span>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">{children}</h3>;
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

// How many homes would match with an option ticked too. Not in the easier-to-read design, where
// the numbers would be one more thing to read beside every option.
function Count({ n }: { n: number }) {
  return (
    <span className="pt-0.5 text-sm tabular-nums text-ink-muted adult:hidden">
      {n}
      <span className="sr-only"> {noun(n)}</span>
    </span>
  );
}

// One folding group of the sheet: its title, what's ticked in it while it's folded, how many are
// ticked, and its options.
function FilterGroupSection({
  idPrefix,
  group,
  picked,
  counts,
  onToggle,
}: {
  idPrefix: string;
  group: FilterGroup;
  picked: string[];
  counts: Record<string, number>;
  onToggle: (slug: string) => void;
}) {
  const [open, setOpen] = useState(group.openByDefault);
  const bodyId = `${idPrefix}-${group.key}`;

  return (
    <div className="border-t border-line-soft">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-14 w-full items-center gap-2.5 px-5 py-3.5 text-left"
      >
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-heading text-lg font-semibold">{group.title}</span>
          {!open && (
            <span className="text-sm text-ink-muted">
              {picked.length > 0 ? picked.map((slug) => optionFor(group, slug)!.label).join(", ") : "Any"}
            </span>
          )}
        </span>
        {picked.length > 0 && (
          <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-on-primary">
            {picked.length}
            <span className="sr-only"> selected</span>
          </span>
        )}
        <Chevron className={`size-[18px] ${open ? "-rotate-90" : "rotate-90"}`} />
      </button>
      {/* Slides open and shut (fold, globals.css); inert keeps it out of reach while it's shut. */}
      <div id={bodyId} className="fold" data-open={open} inert={!open}>
        <div>
          <div className="px-5 pb-4.5">
            <FilterOptions idPrefix={idPrefix} group={group} picked={picked} counts={counts} onToggle={onToggle} />
          </div>
        </div>
      </div>
    </div>
  );
}

// A group's options as checkboxes, the ones families ask about most first, each with how many homes
// it would find. Past the first few, the list folds behind "Show all", with the options asked about
// less (more) after them. Each room type, facility and activity has the site's picture for it before
// its words (AmenityIcon); the care types have none. titled: the group's title is over the
// options, where no button carries it.
function FilterOptions({
  idPrefix,
  group,
  picked,
  counts,
  titled = false,
  onToggle,
}: {
  idPrefix: string;
  group: FilterGroup;
  picked: string[];
  counts: Record<string, number>;
  titled?: boolean;
  onToggle: (slug: string) => void;
}) {
  const { options, title } = group;
  const scripted = useScripted();
  const [showAll, setShowAll] = useState(false);
  // Folded, the list shows the first few main options, and any ticked option so it stays in view.
  const folded = options.filter((option, index) => (!option.more && index < SHOWN_OPTIONS) || picked.includes(option.slug));
  const shown = showAll ? options : folded;

  const row = (option: FilterOption) => {
    const checked = picked.includes(option.slug);
    const n = counts[option.item] ?? 0;
    const inputId = `${idPrefix}-${group.key}-${option.slug}`;
    return (
      <label key={option.slug} htmlFor={inputId} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
        <input
          id={inputId}
          type="checkbox"
          name={group.key}
          value={option.slug}
          checked={checked}
          onChange={() => onToggle(option.slug)}
          className="mt-0.5 size-[18px] shrink-0 accent-primary"
        />
        {/* Greyed when ticking it would find nothing. */}
        <span className={`flex flex-1 items-start gap-2 leading-snug ${checked ? "font-semibold" : ""} ${n === 0 && !checked ? "text-ink-muted" : ""}`}>
          <AmenityIcon item={option.item} />
          {option.label}
        </span>
        <Count n={n} />
      </label>
    );
  };

  return (
    <>
      <fieldset>
        <legend className={titled ? "pb-1 font-heading text-lg font-semibold" : "sr-only"}>{title}</legend>
        {shown.map(row)}
        {/* "Show all" needs scripts, so without them the rest of the options are listed here. */}
        <noscript>{options.filter((option) => !folded.includes(option)).map(row)}</noscript>
      </fieldset>
      {scripted && folded.length < options.length && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="min-h-11 py-2 text-sm font-semibold text-primary underline">
          {showAll ? "Show fewer" : `Show all ${options.length}`}
        </button>
      )}
    </>
  );
}

// "Sort by", which goes to the first page in the new order. compact: the phones' bar, without the
// visible label.
export function SortSelect({ search, compact = false }: { search: FilterState; compact?: boolean }) {
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className={compact ? "sr-only" : "text-sm text-ink-muted"}>
        Sort by
      </label>
      <SelectFrame>
        <select
          id={id}
          value={search.sort}
          onChange={(event) => router.push(searchHref({ ...search, sort: event.target.value as FilterState["sort"] }), { scroll: false })}
          className={`${textInputClass} ${selectClass} ${compact ? "rounded-full font-semibold" : ""}`}
        >
          {SORTS.filter((option) => option.value !== "distance" || search.near).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </SelectFrame>
    </div>
  );
}
