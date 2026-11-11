// app/search/page.tsx
import { Alert } from "@/components/layout/alert";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { ShortlistDrawer } from "@/components/compare/shortlist-drawer";
import { ShortlistToast } from "@/components/compare/shortlist-toast";
import { CardResult } from "@/components/search/card-result";
import { GoogleForSearch, GoogleMapsLoader } from "@/components/search/google-places";
import { RememberSearch } from "@/components/search/last-search";
import { ResultsMap } from "@/components/search/results-map";
import { SearchFilters, SortSelect } from "@/components/search/search-filters";
import { MapUnavailable, ViewSwitch } from "@/components/search/view-switch";
import { actionLinkClass, fullWidthClass, primaryButtonClass } from "@/components/ui/classes";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";
import { authRuntime } from "@/lib/auth";
import { authConfigured, sessionSubject } from "@/lib/auth-config";
import { formatDate } from "@/lib/centres";
import { hasSavedChoices, savedSearchHref, type SavedSearch } from "@/lib/preferences";
import { filtersClearedHref, hasSearch, leavesHomesOut, readSearch, searchHref, type PageSearch } from "@/lib/page-search";
import { pointsConfigured, readPoints } from "@/lib/points-api";
import { preferencesConfigured, readSavedSearch } from "@/lib/preferences-api";
import { formatEircode, searchCentres, unavailableMessage, type RegisterSnapshot, type SearchResponse } from "@/lib/search";
import { editedText, NOBODY_TO_ASK, settleBox } from "@/lib/search-box";
import { activeFilters, apiFilterParams, filterCount, NO_FILTERS } from "@/lib/search-filters";
import Link from "next/link";
import { redirect } from "next/navigation";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// The results are one column of cards beside the filters. 24 to a page divides by 1, 2 and 3,
// should a grid come back, so every full page fills its last row. The API's default of 20 would
// leave gaps.
const RESULTS_PER_PAGE = "24";

function noun(count: number) {
  return count === 1 ? "nursing home" : "nursing homes";
}

// "matching “aras” in Co. Mayo": what the results were filtered by. A place with a point to measure
// from filters nothing (measuredFrom says where it is).
function describe({ name, place, near, county, query }: Pick<PageSearch, "name" | "place" | "near" | "county" | "query">) {
  const parts = [
    name && `matching “${name}”`,
    place && !near && (query.eircode ? `near ${formatEircode(query.eircode)}` : `in “${place}”`),
    county && `in Co. ${county}`,
  ].filter(Boolean);
  return parts.join(" ");
}

// What the headings and titles call a point: the place it was picked as, or "the chosen location" for
// the visitor's own location, which has no name.
function pointName(place: string) {
  return place || "the chosen location";
}

// "nearest to Rathmines, Dublin first", or "" without a point (CCARE-228). Never "near" or "in" the
// place: every matching home is listed, so the words must not read as if only nearby ones were.
function measuredFrom({ place, near, sort }: Pick<PageSearch, "place" | "near" | "sort">) {
  if (!near) return "";
  if (sort === "distance") return place ? `nearest to ${place} first` : "nearest first";
  return `with distances from ${pointName(place)}`;
}

// What follows "547 nursing homes" in the results heading, or "Nursing homes" in the page title:
// " matching “elm”, nearest to Rathmines, Dublin first", or "" when only filters were chosen.
function described(search: PageSearch) {
  const where = describe(search);
  const from = measuredFrom(search);
  return `${where ? ` ${where}` : ""}${from ? `, ${from}` : ""}`;
}

// The results heading and the page title for a point alone, which lists every home, so there is no
// count (leavesHomesOut): "Nursing homes nearest to Rathmines, Dublin".
function fromPointAlone({ place, sort }: Pick<PageSearch, "place" | "sort">) {
  const point = pointName(place);
  return sort === "distance" ? `Nursing homes nearest to ${point}` : `Nursing homes, with distances from ${point}`;
}

// The form was sent with every field empty: its fields arrive as "", so the keys are there.
async function sentEmpty(searchParams: SearchPageProps["searchParams"]) {
  const params = await searchParams;
  return ["name", "place", "county"].some((key) => key in params);
}

// The home page box sends q, and so does this page's box when its form is sent without scripts,
// beside the search it was drawn from and the filters chosen. The page goes on to the search the
// box's rule makes of the text (settleBox, lib/search-box.ts).
//
// Google is asked only in the browser, so here a town or an area can't be looked up as a place and
// would end as a name. Such text is returned for the browser to settle (SearchFilters), over the
// page for nothing searched. A form that says scripts are off gets the name search instead: both
// forms say so, the home page's in a <noscript>.
async function settleSentText(searchParams: SearchPageProps["searchParams"]) {
  const { q, scripts, ...sentWithIt } = await searchParams;
  if (q === undefined) return null;
  const text = ((Array.isArray(q) ? q[0] : q) ?? "").trim();
  const sent = readSearch(sentWithIt);
  const search = await settleBox(editedText(sent, text, sent), { ...NOBODY_TO_ASK, searched: sent });
  if (scripts !== "off" && search.name && search.name !== sent.name) return text;
  // An empty box goes on as an empty name, so it gets "Please enter something to search for"
  // (sentEmpty).
  redirect(hasSearch(search) ? searchHref(search) : "/search?name=");
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const search = readSearch(await searchParams);
  if (!hasSearch(search)) return { title: "Find a nursing home" };
  if (!leavesHomesOut(search)) return { title: fromPointAlone(search) };
  const what = described(search);
  return { title: what ? `Nursing homes${what}` : "Search results" };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const arrivedWith = await settleSentText(searchParams);
  const params = await searchParams;
  const search = readSearch(params);
  // Read on each request, after the address made the page dynamic, rather than at build: the Docker
  // image is built once and must not carry it (README).
  const googleKey = process.env.GOOGLE_MAPS_BROWSER_KEY || null;
  // The map's pins are advanced markers, which Google draws only on a map with a map ID (README).
  const mapId = process.env.GOOGLE_MAPS_MAP_ID || null;
  // No home is listed until something is searched for (CCARE-164): a full list of every home
  // read as if the search had been done for them. The list still isn't shown; every home is on a
  // map under the prompt instead (mapOfEveryHome, below).
  const searched = hasSearch(search);

  // The account's saved search, read here rather than in the browser (ADR-0025). A visitor with no
  // account makes no request at all, and one who keeps a search is sent straight to it below, so
  // they never see the prompt render and then be replaced. The filters panel is told what was found,
  // so it shows the button and "Forget my preferences" without asking again.
  const signedIn = authConfigured() ? sessionSubject(await authRuntime().auth()) : null;
  const kept = signedIn && preferencesConfigured() ? await readSavedSearch(signedIn) : null;
  const saved: SavedSearch | null = kept?.ok ? kept.saved : null;
  const initialSaved = {
    status: !signedIn
      ? ("signed_out" as const)
      : kept?.ok
        ? ("ready" as const)
        : ("unavailable" as const),
    saved,
  };
  // A returning visitor who has asked for nothing opens the search they kept. "Nothing" is an
  // address with no query at all, not an address the API finds no search in: ?sort=latest_inspection
  // is somewhere a visitor arrived on purpose (Clear all with a changed order, or the last tag
  // removed), and opening the saved search over it would undo what they did. It would also loop when
  // the order is the only thing saved, since that is exactly the address it redirects to.
  if (Object.keys(params).length === 0 && saved && hasSavedChoices(saved)) redirect(savedSearchHref(saved));
  // page_size isn't added to the query itself, so it stays out of the page links.
  const result = searched
    ? await searchCentres({ ...search.query, page_size: search.query.page_size ?? RESULTS_PER_PAGE }, apiFilterParams(search.selection))
    : null;
  const data = result?.ok ? result.data : null;
  // Before a search, the filters still offer every option with its count across all homes, so
  // someone can start from the care they need. Only the counts are asked for: one result, not shown.
  const start = searched ? null : await searchCentres({ page: "1", page_size: "1" });
  // null only when the API couldn't be read: the filters then leave out the care and amenity groups,
  // and the page says the search is unavailable.
  const facets = (data ?? (start?.ok ? start.data : null))?.facets ?? null;

  // The page's map (CCARE-229), when this deployment can draw one: Google's key and map ID for the
  // map, and the token the API gives the points for (ADR-0029).
  const mapPossible = Boolean(googleKey && mapId && pointsConfigured());
  // The results as a map, offered once there are results to show. Only then does view=map in the
  // address mean anything.
  const mapOffered = mapPossible && Boolean(data && data.total > 0);
  const mapView = mapOffered && search.view === "map";
  // Before anything is searched, every home on a map under the prompt, with no switch: there is no
  // list to switch to.
  const mapOfEveryHome = mapPossible && !searched;
  // The points are every matching home's, not this page of the list's, and every home's when nothing
  // is searched. They are read on the server for each map and handed to it as props.
  const points = mapView || mapOfEveryHome ? await readPoints(search) : null;
  const pins = points?.ok && points.points.length > 0 ? points.points : null;
  const listHref = searchHref({ ...search, view: "list" });

  return (
    // What the search boxes in the filters and the page's map share of Google.
    <GoogleForSearch apiKey={googleKey}>
      {/* Notes these filters for "Search for other homes" on Compare Homes (CCARE-214). */}
      <RememberSearch />
      <SearchHero />

      {/* From md up, the filters in a column on the left and the results on the right (CCARE-189):
          with the care and amenity filters, there are too many kinds of filter for a bar above the
          results (Baymard). Below md, a Filters button opens them in a sheet. */}
      <div className="grid gap-6 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8">
        <SearchFilters
          search={search}
          facets={facets}
          total={data ? data.total : null}
          sortShown={data !== null && !mapView}
          initialSaved={initialSaved}
          arrivedWith={arrivedWith}
        />

        <section aria-label="Results" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ShortlistDrawer />
            <div className="flex flex-wrap items-center gap-3">
              {mapOffered && <ViewSwitch search={search} />}
              {/* The order, once there are results to order; pins have none. On phones it's in the
                  bar with Filters. */}
              {data && !mapView && (
                <div className="hidden md:block">
                  <SortSelect search={search} />
                </div>
              )}
            </div>
          </div>

          {result === null ? (
            <SearchPrompt empty={await sentEmpty(searchParams)} filters={facets !== null} />
          ) : result.ok ? (
            <ResultsHeading search={search} total={result.data.total} />
          ) : (
            <SearchError status={result.status} detail={result.detail} />
          )}

          {/* Google's loader has this one place whatever else the page shows, since a search box can
              ask for it before any search. The map is drawn inside it; keyed by the search, so a new
              search opens on its own pins. Before a search it has no list to lead back to. */}
          <GoogleMapsLoader>
            {pins && mapId && (
              <ResultsMap key={listHref} points={pins} near={search.near} place={search.place} mapId={mapId} listHref={searched ? listHref : undefined} />
            )}
          </GoogleMapsLoader>
          {/* Only for a map that was asked for. Before a search nobody asked for one, and without its
              points the page is the prompt alone. */}
          {mapView && points && !pins && <MapUnavailable listHref={listHref} located={points.ok} />}

          {data && !mapView && <ResultsList search={search} data={data} />}
          {data && <Source snapshot={data.register_snapshot} />}
        </section>
      </div>

      <ShortlistToast />

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </GoogleForSearch>
  );
}

// The top of the page, flush under the header as on the resources page: the heading and a line of
// welcome on the soft welcome band (welcome-band, globals.css). The results say what was searched,
// so the heading stays the task.
function SearchHero() {
  return (
    <section aria-labelledby="search-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
      <div className="page-column flex flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb trail={[]} current="Search for Homes" />
        <h1 id="search-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Find a nursing home
        </h1>
        <p className="max-w-2xl text-ink-muted md:text-lg">
          Search every nursing home registered with HIQA. Each one has a page with its inspection reports over time.
        </p>
      </div>
    </section>
  );
}

// In place of results before anything is searched for: what to enter, in a tinted panel like the
// no-results one, with the icon in a soft circle, and where to start for a family new to this. If
// the form was sent empty, it says so instead. filters: the care and amenity filters are offered.
// The map of every home, where there is one, comes under it.
function SearchPrompt({ empty, filters }: { empty: boolean; filters: boolean }) {
  return (
    <section
      aria-labelledby="prompt-h"
      className="flex flex-col items-start gap-4 rounded-2xl bg-tint-blue p-6 sm:flex-row md:p-8 adult:rounded-lg adult:bg-band"
    >
      <IconCircle path={ICON_PATHS.search} size="large" tint="band" />
      <div className="flex flex-col gap-2">
        <h2 id="prompt-h" className="font-heading text-xl font-semibold text-ink md:text-2xl">
          {empty
            ? "Please enter something to search for"
            : filters
              ? "Start with a name, a place or the care you need"
              : "Start with a name, a town or a county"}
        </h2>
        <p className="text-ink-muted">
          Not sure where to start?{" "}
          <Link href="/guides/how-a-family-chooses" className="text-ink tap-target">
            Read how a family chooses a nursing home →
          </Link>
        </p>
      </div>
    </section>
  );
}

// What was found and the filters in use, over the list and over the map alike.
function ResultsHeading({ search, total }: { search: PageSearch; total: number }) {
  const filters = activeFilters(search.selection);

  return (
    <>
      <h2 aria-live="polite" className="font-heading text-2xl font-semibold leading-tight md:text-[1.625rem]">
        {/* With only filters, no name, place or county: "12 nursing homes found". */}
        {leavesHomesOut(search) ? (
          <>
            {total} {noun(total)}
            {described(search) || " found"}
          </>
        ) : (
          fromPointAlone(search)
        )}
      </h2>

      {/* The filters in use, each removable, as links so they work without scripts. On phones they
          scroll sideways in one row. */}
      {filters.length > 0 && (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {filters.map((filter) => (
            <Link
              key={filter.id}
              href={filtersClearedHref({ ...search, selection: filter.without })}
              scroll={false}
              aria-label={`Remove filter: ${filter.label}`}
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-primary bg-surface pl-3 pr-2.5 text-[0.8125rem] font-medium text-ink no-underline hover:bg-surface-muted adult:rounded-md"
            >
              {filter.label}
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="size-3">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Link>
          ))}
          <Link href={filtersClearedHref({ ...search, selection: NO_FILTERS })} scroll={false} className="inline-flex min-h-8 shrink-0 items-center px-1.5 text-[0.8125rem]">
            Clear all
          </Link>
        </div>
      )}
    </>
  );
}

// The results as cards, a page at a time.
function ResultsList({ search, data }: { search: PageSearch; data: SearchResponse }) {
  const { centres, page, page_size, total } = data;
  const lastPage = Math.max(1, Math.ceil(total / page_size));
  const where = describe(search);

  return (
    <>
      {total === 0 ? (
        filterCount(search.selection) > 0 ? (
          <NoMatches search={search} />
        ) : (
          // In a tinted panel like the resources page's official information, with a way back to every
          // home, so a search that finds nothing isn't a dead end.
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-band p-6 md:p-8 adult:rounded-lg">
            <p className="font-heading text-xl font-semibold text-ink md:text-2xl">
              We couldn&apos;t find a registered home {where || "for this search"}
            </p>
            <p className="text-ink-muted">A few things that often help:</p>
            <ul className="list-disc pl-5 text-ink-muted">
              <li>Check the spelling, or type the start of each word, e.g. &ldquo;elm&rdquo; for Elm Hall.</li>
              <li>&ldquo;St&rdquo; and &ldquo;Saint&rdquo; are searched separately, so try the other one.</li>
              <li>Many Dublin addresses don&apos;t include &ldquo;Dublin&rdquo;. Use the County filter instead.</li>
            </ul>
            <Link href="/search" className={`${actionLinkClass} mt-2`}>
              Start a new search <span aria-hidden>→</span>
            </Link>
          </div>
        )
      ) : centres.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-band p-6 md:p-8 adult:rounded-lg">
          <p className="text-ink-muted">There&apos;s no page {page} for this search.</p>
          <Link href={searchHref(search)} className={actionLinkClass}>
            Go to the first page <span aria-hidden>→</span>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {centres.map((centre) => (
            <CardResult key={centre.centre_id} centre={centre} selection={search.selection} />
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav aria-label="Result pages" className="flex items-center justify-between gap-4 text-sm">
          {page > 1 ? <Link href={searchHref(search, page - 1)} className="tap-target">&larr; Previous</Link> : <span />}
          <span className="text-ink-muted">
            Page {Math.min(page, lastPage)} of {lastPage}
          </span>
          {page < lastPage ? <Link href={searchHref(search, page + 1)} className="tap-target">Next &rarr;</Link> : <span />}
        </nav>
      )}
    </>
  );
}

function Source({ snapshot }: { snapshot: RegisterSnapshot }) {
  return (
    <p className="text-xs text-ink-faint">
      Source:{" "}
      <a href={snapshot.url} className="text-ink-faint adult:text-primary">
        HIQA register
      </a>
      , downloaded {formatDate(snapshot.fetched_at)}.
    </p>
  );
}

// No home has everything ticked: the counts in the filters show which choice rules out the most, and
// one click clears them all.
function NoMatches({ search }: { search: PageSearch }) {
  const count = filterCount(search.selection);

  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6 md:p-8 adult:rounded-lg">
      <h3 className="font-heading text-[1.375rem] font-semibold">
        No homes match all {count} {count === 1 ? "filter" : "filters"}
      </h3>
      <p className="text-ink-muted">Remove the filter that is ruling out the most homes, or clear them and start again.</p>
      <Link href={filtersClearedHref({ ...search, selection: NO_FILTERS })} scroll={false} className={`${primaryButtonClass} inline-flex h-auto min-h-11 items-center py-2 no-underline`}>
        Clear all filters
      </Link>
    </div>
  );
}

function SearchError({ status, detail }: { status: number; detail: string }) {
  const message = status === 400 ? detail : unavailableMessage(status);

  return (
    <Alert title={status === 400 ? "Please check your search" : "Search unavailable"}>{message}</Alert>
  );
}
