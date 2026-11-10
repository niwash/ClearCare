"use client";

// The search page's filters (CCARE-189): where to look, with the place box (PlaceBox, CCARE-228),
// then the care and amenity filters (lib/search-filters.ts) in folding groups. From md up they're a column beside the
// results; on phones they open in a full-screen sheet from a "Filters" button. Either way, choices
// apply on "Show n nursing homes" (or Enter), not as they're made, so the results don't change
// under someone still choosing. Until then the counts, and the number on the button, are asked for
// as choices change (/search/count). Every choice is in the page address, so a search can be shared
// as a link. It's a real form, so without scripts it still searches.
//
// The care and amenity groups need the counts (facets): when the API can't be read, they're left
// out rather than offered without them.
import { Chevron } from "@/components/ui/chevron";
import { textInputClass } from "@/components/ui/classes";
import { PreferencesNotice } from "@/components/preferences/preferences-notice";
import { SavePreferencesButton } from "@/components/preferences/save-preferences-button";
import { hydrateSavedSearch, type SavedSearchInitial } from "@/components/preferences/saved-search-store";
import { useGooglePlaces, type GooglePlaces } from "@/components/search/google-places";
import { forgetLastSearch } from "@/components/search/last-search";
import { PlaceBox } from "@/components/search/place-box";
import { filtersClearedHref, leavesHomesOut, searchHref, type PageSearch } from "@/lib/page-search";
import { needsLookup, settlePlace, withoutDistance, type PendingPick } from "@/lib/place-search";
import { savedSearchFrom } from "@/lib/preferences";
import { ANY_COUNTY, COUNTIES, MAX_TEXT_LENGTH, type Facets } from "@/lib/search";
import {
  filterCount,
  FILTER_GROUPS,
  NO_FILTERS,
  optionFor,
  SHOWN_OPTIONS,
  SORTS,
  toggled,
  type FilterGroup,
  type FilterGroupKey,
} from "@/lib/search-filters";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type Dispatch, type ReactNode, type SetStateAction } from "react";

// view is not a filter, but it is in the page address with them, so the draft carries it and a new
// search keeps the list or the map the visitor was on.
type FilterState = Pick<PageSearch, "name" | "place" | "near" | "county" | "selection" | "sort" | "view">;

const EMPTY: FilterState = { name: "", place: "", near: "", county: "", selection: NO_FILTERS, sort: "name", view: "list" };
// How long after the last change its counts are asked for.
const PAUSE = 250;
// How long Search waits for Google to place the box's text before searching it as text.
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
}: {
  search: FilterState;
  facets: Facets | null;
  total: number | null; // null before anything is searched for
  sortShown: boolean;
  // What the page read from the account on the server (ADR-0025): whether there is a saved search,
  // and whether one could be read at all. Handed down rather than fetched here, so a visitor with no
  // account sends no request, and the page has already opened a kept search before it renders.
  initialSaved: SavedSearchInitial;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const applied = searchHref(search);

  // The choices not yet applied, in the column or the sheet. They start as what's applied, and go
  // back to it whenever the page address changes (a search, a tag removed, the back button).
  const sheet = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<FilterState>(search);
  const [draftFor, setDraftFor] = useState(applied);
  if (draftFor !== applied) {
    setDraftFor(applied);
    setDraft(search);
  }
  const [fetched, setFetched] = useState<{ total: number | null; facets: Facets | null; search: FilterState } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const draftHref = searchHref(draft);
  // What "Save my preferences" keeps: the choices in the form, not the words typed into the search
  // boxes (lib/preferences.ts). It sits under the Search button, so it saves what is about to be
  // searched for, and applies it once stored.
  const savedFromDraft = savedSearchFrom(draft);
  // Google's suggestions for the place boxes, loaded once the visitor types in one, and a picked
  // place whose location Google is still giving, which Search waits for.
  const google = useGooglePlaces();
  const pick = useRef<PendingPick | null>(null);
  // Counts presses of Search: a lookup can take up to LOOKUP_LIMIT, so an older press can finish last.
  const searches = useRef(0);
  // Text in the place box that Search will look up first: a count now would be for the wrong search.
  const lookingUp = google.inUse && needsLookup(draft, search);

  // The account's saved choices, as the page read them on the server. The button under Search
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

  function openSheet() {
    setDraft(search);
    setFetched(null);
    setSheetOpen(true);
    sheet.current?.showModal();
  }

  async function apply() {
    sheet.current?.close();
    const thisSearch = ++searches.current;
    // The place box's text as Google places it, or as it is (lib/place-search.ts).
    const settled = await settlePlace(draft, {
      searched: search,
      pick: pick.current,
      findFirst: google.inUse ? google.findFirst : null,
      deadline: new Promise((resolve) => setTimeout(resolve, LOOKUP_LIMIT)),
    });
    if (thisSearch !== searches.current) return;
    // A search with every field emptied goes to the page that says so (?filtersCleared=true) rather than to
    // /search, which is the arrival that opens the visitor's saved search again. Without this,
    // "Clear all" followed by Search would put the cleared filters straight back.
    startTransition(() => router.push(filtersClearedHref(settled), { scroll: false }));
  }

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
  const place = {
    google,
    onPick: (picked: PendingPick) => {
      pick.current = picked;
    },
  };

  const active =
    filterCount(search.selection) + (search.name ? 1 : 0) + (search.place || search.near ? 1 : 0) + (search.county ? 1 : 0);

  return (
    <>
      {/* From md up: the column beside the results. */}
        <PreferencesNotice />

      <aside aria-label="Filters" className="hidden md:block">
        <FilterPanel
          state={draft}
          onChange={setDraft}
          place={place}
          facets={draftCount.facets}
          onSubmit={apply}
          footer={
            // Kept in view at the bottom of the window while the column is taller than it, with
            // "Clear all" under the button once something is set.
            <div className={`sticky bottom-0 flex flex-col items-center gap-2 rounded-b-2xl border-t border-line bg-surface px-5 pt-3.5 adult:rounded-b-lg ${canClear ? "pb-2" : "pb-3.5"}`}>
              <button type="submit" aria-live="polite" className="min-h-12 w-full rounded-full bg-primary px-4 font-bold text-on-primary hover:bg-primary-hover">
                {showLabel}
              </button>
              {/* Under the Search button: the choices are made here, so this is where they are
                  kept (ADR-0025). It applies them once saved, so the results on screen are the ones
                  the account remembers. */}
              <div className="w-full">
                <SavePreferencesButton current={savedFromDraft} onSaved={apply} onForgotten={startOver} />
              </div>
              {canClear && (
                <button type="button" onClick={clear} className="min-h-11 px-2 text-sm text-primary underline">
                  Clear all
                </button>
              )}
            </div>
          }
          rounded
        />
      </aside>

      {/* Below md: a bar with Filters and the order, kept at the top while the results scroll. */}
      <div className="sticky top-0 z-20 -mx-4 flex gap-2 border-b border-line-soft bg-page px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={openSheet}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-on-primary"
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="size-[18px]">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filters
          {active > 0 && (
            <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-surface px-1.5 text-xs font-bold text-primary">
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
        onClose={() => setSheetOpen(false)}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-ink md:hidden"
      >
        {sheetOpen && (
          <div className="flex h-full flex-col">
            <div className="flex min-h-15 items-center gap-2 border-b border-line py-2 pl-5 pr-2">
              <h2 id="sheet-h" className="flex-1 text-xl font-bold">
                Filters
              </h2>
              <button type="button" onClick={clear} className="min-h-11 px-2.5 text-[15px] text-primary underline">
                Clear all
              </button>
              <button
                type="button"
                onClick={() => sheet.current?.close()}
                aria-label="Close filters"
                className="inline-flex size-11 items-center justify-center rounded-full bg-surface-muted"
              >
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="size-[18px]">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FilterPanel state={draft} onChange={setDraft} place={place} facets={draftCount.facets} onSubmit={apply} summaries />
            </div>
            <div className="border-t border-line bg-surface px-5 pb-5 pt-3 shadow-[0_-6px_16px_rgb(31_42_55/0.06)]">
              <button type="button" onClick={apply} className="min-h-13 w-full rounded-full bg-primary text-[17px] font-bold text-on-primary">
                {showLabel}
              </button>
              <div className="mt-2 w-full">
                <SavePreferencesButton current={savedFromDraft} onSaved={apply} onForgotten={startOver} />
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

// The form itself, the same in the column and the sheet. Changing anything calls onChange; the
// caller decides when it applies.
function FilterPanel({
  state,
  onChange,
  place,
  facets,
  footer,
  rounded = false,
  summaries = false,
  onSubmit,
}: {
  state: FilterState;
  onChange: Dispatch<SetStateAction<FilterState>>;
  place: { google: GooglePlaces; onPick: (pick: PendingPick) => void };
  facets: Facets | null;
  footer?: ReactNode;
  rounded?: boolean;
  // Folded groups say what's ticked in them, under their title (the sheet, where most start folded).
  summaries?: boolean;
  onSubmit?: () => void;
}) {
  const id = useId();
  const router = useRouter();

  return (
    <form
      action="/search"
      method="GET"
      role="search"
      aria-label="Search nursing homes"
      onSubmit={(event) => {
        event.preventDefault();
        if (onSubmit) onSubmit();
        else router.replace(searchHref(state), { scroll: false });
      }}
      className={rounded ? "rounded-2xl border border-line bg-surface adult:rounded-lg" : ""}
    >
      <div className="flex flex-col gap-4 px-5 pb-5 pt-4.5">
        <SectionHeading>Home location</SectionHeading>
        <Field id={`${id}-name`} label="Nursing home name">
          {/* No faded example in any field: people read one as already filled in (CCARE-164). */}
          <input
            id={`${id}-name`}
            name="name"
            type="search"
            value={state.name}
            onChange={(event) => onChange({ ...state, name: event.target.value })}
            maxLength={MAX_TEXT_LENGTH}
            className={`${textInputClass} w-full`}
          />
        </Field>
        <Field id={`${id}-place`} label="Town, area or Eircode">
          <PlaceBox id={`${id}-place`} draft={state} onChange={onChange} google={place.google} onPick={place.onPick} />
        </Field>
        <Field id={`${id}-county`} label="County">
          <select
            id={`${id}-county`}
            name="county"
            value={state.county || ANY_COUNTY}
            onChange={(event) => onChange({ ...state, county: event.target.value === ANY_COUNTY ? "" : event.target.value })}
            className={`${textInputClass} w-full`}
          >
            <option value={ANY_COUNTY}>Any county</option>
            {COUNTIES.map((county) => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </select>
        </Field>
        {state.sort !== "name" && <input type="hidden" name="sort" value={state.sort} />}
        {state.view === "map" && <input type="hidden" name="view" value="map" />}
        {/* In the sheet, whose button is outside the form: so Enter searches, and without scripts
            the form can be sent. The column has its own in the footer. */}
        {!footer && (
          <button type="submit" className="sr-only focus:not-sr-only focus:self-start focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary">
            Search
          </button>
        )}
      </div>

      {facets && (
        <>
          <div className="border-t border-line px-5 pb-1.5 pt-4.5">
            <SectionHeading>Care &amp; living</SectionHeading>
            {/* Every group below is filled from the amenities an AI tool read from the reports
                (centre_amenities_v2), so it says so here as the result cards and centre page do.
                Drop "We're now checking" when CCARE-192 and -193 are done. */}
            <p className="mt-1.5 text-xs text-ink-muted">
              Read by an AI tool from each home&apos;s inspection report. We&apos;re now checking these.
            </p>
          </div>
          {FILTER_GROUPS.map((group) => (
            <FilterGroupSection
              key={group.key}
              idPrefix={id}
              group={group}
              picked={state.selection[group.key]}
              counts={facets[group.param]}
              summary={summaries}
              onToggle={(slug) => onChange({ ...state, selection: toggled(state.selection, group.key as FilterGroupKey, slug) })}
            />
          ))}
        </>
      )}

      {footer}
    </form>
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

// One folding group of checkboxes: its title, how many are ticked, and the options, the ones
// families ask about most first, each with how many homes it would find. Past the first few, the
// list folds behind "Show all", with the options asked about less (more) after them.
function FilterGroupSection({
  idPrefix,
  group,
  picked,
  counts,
  summary,
  onToggle,
}: {
  idPrefix: string;
  group: FilterGroup;
  picked: string[];
  counts: Record<string, number>;
  summary: boolean;
  onToggle: (slug: string) => void;
}) {
  const { options, title } = group;
  const [open, setOpen] = useState(group.openByDefault);
  const [showAll, setShowAll] = useState(false);
  const bodyId = `${idPrefix}-${group.key}`;
  // Folded, the list shows the first few main options, and any ticked option so it stays in view.
  const folded = options.filter((option, index) => (!option.more && index < SHOWN_OPTIONS) || picked.includes(option.slug));
  const shown = showAll ? options : folded;

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
          <span className="font-heading text-lg font-semibold">{title}</span>
          {summary && !open && (
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
            <fieldset>
              <legend className="sr-only">{title}</legend>
              {shown.map((option) => {
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
                    <span className={`flex-1 leading-snug ${checked ? "font-semibold" : ""} ${n === 0 && !checked ? "text-ink-muted" : ""}`}>
                      {option.label}
                    </span>
                    <Count n={n} />
                  </label>
                );
              })}
            </fieldset>
            {folded.length < options.length && (
              <button type="button" onClick={() => setShowAll(!showAll)} className="min-h-11 py-2 text-sm font-semibold text-primary underline">
                {showAll ? "Show fewer" : `Show all ${options.length}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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
      <select
        id={id}
        value={search.sort}
        onChange={(event) => router.push(searchHref({ ...search, sort: event.target.value as FilterState["sort"] }), { scroll: false })}
        className={`${textInputClass} ${compact ? "rounded-full font-semibold" : ""}`}
      >
        {SORTS.filter((option) => option.value !== "distance" || search.near).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
