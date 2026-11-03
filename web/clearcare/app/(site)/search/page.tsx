// app/search/page.tsx
import { Alert } from "@/components/layout/alert";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { ShortlistDrawer } from "@/components/compare/shortlist-drawer";
import { ShortlistToast } from "@/components/compare/shortlist-toast";
import { CardResult } from "@/components/search/card-result";
import { SearchFilters, SortSelect } from "@/components/search/search-filters";
import { actionLinkClass, fullWidthClass, primaryButtonClass } from "@/components/ui/classes";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";
import { formatDate } from "@/lib/centres";
import {
  formatEircode,
  hasSearch,
  looksLikeEircode,
  readSearch,
  searchCentres,
  searchHref,
  unavailableMessage,
  type PageSearch,
  type SearchResponse,
} from "@/lib/search";
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

// "matching “aras” in Co. Mayo", for the results heading and the page title.
function describe({ name, place, county }: Pick<PageSearch, "name" | "place" | "county">) {
  const parts = [
    name && `matching “${name}”`,
    place && (looksLikeEircode(place) ? `near ${formatEircode(place.replace(/\s+/g, "").toUpperCase())}` : `in “${place}”`),
    county && `in Co. ${county}`,
  ].filter(Boolean);
  return parts.join(" ");
}

// The form was sent with every field empty: its fields arrive as "", so the keys are there.
async function sentEmpty(searchParams: SearchPageProps["searchParams"]) {
  const params = await searchParams;
  return ["name", "place", "county"].some((key) => key in params);
}

// The home page box sends q. The API has no combined search, so send it on as a place if it looks
// like an Eircode, otherwise as a name. An empty box goes on as an empty name, so it gets the same
// "Please enter something" as an empty search here.
async function redirectHomeSearch(searchParams: SearchPageProps["searchParams"]) {
  const value = (await searchParams).q;
  if (value === undefined) return;
  const q = (Array.isArray(value) ? value[0] : value)?.trim();
  if (!q) redirect("/search?name=");
  redirect(`/search?${new URLSearchParams({ [looksLikeEircode(q) ? "place" : "name"]: q })}`);
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const search = readSearch(await searchParams);
  if (!hasSearch(search)) return { title: "Find a nursing home" };
  const where = describe(search);
  return { title: where ? `Nursing homes ${where}` : "Search results" };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  await redirectHomeSearch(searchParams);
  const search = readSearch(await searchParams);
  // Nothing is listed until something is searched for (CCARE-164): a full list of every home
  // read as if the search had been done for them.
  const searched = hasSearch(search);
  // page_size isn't added to the query itself, so it stays out of the page links.
  const result = searched
    ? await searchCentres({ ...search.query, page_size: search.query.page_size ?? RESULTS_PER_PAGE }, apiFilterParams(search.selection))
    : null;
  const data = result?.ok ? result.data : null;
  // Before a search, the filters still offer every option with its count across all homes, so
  // someone can start from the care they need. Only the counts are asked for: one result, not shown.
  const start = searched ? null : await searchCentres({ page: "1", page_size: "1" });
  // The care and amenity filters only count once the API counts them (lib/search.ts). Before
  // then, any in the address are ignored here as they are by the API, so nothing says it's filtered.
  const facets = (data ?? (start?.ok ? start.data : null))?.facets ?? null;
  const shown: PageSearch = facets ? search : { ...search, selection: NO_FILTERS };

  return (
    <>
      <SearchHero />

      {/* From md up, the filters in a column on the left and the results on the right (CCARE-189):
          with the care and amenity filters, there are too many kinds of filter for a bar above the
          results (Baymard). Below md, a Filters button opens them in a sheet. */}
      <div className="grid gap-6 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8">
        <SearchFilters search={search} facets={facets} total={data ? data.total : null} sortShown={Boolean(data?.sort)} />

        <section aria-label="Results" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ShortlistDrawer />
            {/* The order, once the API applies it (it says so by echoing it). On phones it's in the
                bar with Filters. */}
            {data?.sort && (
              <div className="hidden md:block">
                <SortSelect search={search} />
              </div>
            )}
          </div>

          {result === null ? (
            <SearchPrompt empty={await sentEmpty(searchParams)} filters={facets !== null} />
          ) : result.ok ? (
            <Results search={shown} data={result.data} />
          ) : (
            <SearchError status={result.status} detail={result.detail} />
          )}
        </section>
      </div>

      <ShortlistToast />

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
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

function Results({ search, data }: { search: PageSearch; data: SearchResponse }) {
  const { centres, page, page_size, total, register_snapshot } = data;
  const lastPage = Math.max(1, Math.ceil(total / page_size));
  const where = describe(search);
  const filters = activeFilters(search.selection);

  return (
    <>
      <h2 aria-live="polite" className="font-heading text-2xl font-semibold leading-tight md:text-[1.625rem]">
        {/* With only filters, no name, place or county: "12 nursing homes found". */}
        {total} {noun(total)} {where || "found"}
      </h2>

      {/* The filters in use, each removable, as links so they work without scripts. On phones they
          scroll sideways in one row. */}
      {filters.length > 0 && (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {filters.map((filter) => (
            <Link
              key={filter.id}
              href={searchHref({ ...search, selection: filter.without })}
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
          <Link href={searchHref({ ...search, selection: NO_FILTERS })} scroll={false} className="inline-flex min-h-8 shrink-0 items-center px-1.5 text-[0.8125rem]">
            Clear all
          </Link>
        </div>
      )}

      {total === 0 ? (
        filterCount(search.selection) > 0 ? (
          <NoMatches search={search} relaxations={data.relaxations} />
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

      <p className="text-xs text-ink-faint">
        Source:{" "}
        <a href={register_snapshot.url} className="text-ink-faint adult:text-primary">
          HIQA register
        </a>
        , downloaded {formatDate(register_snapshot.fetched_at)}.
      </p>
    </>
  );
}

// No home has everything ticked: the filter that rules out the most, with how many there'd be
// without it (relaxations, from the API), so the way out is one click.
function NoMatches({ search, relaxations }: { search: PageSearch; relaxations: SearchResponse["relaxations"] }) {
  const filters = activeFilters(search.selection);
  const best = (relaxations ?? [])
    .map((relaxation) => ({
      ...relaxation,
      filter: filters.find((filter) => filter.param === relaxation.param && (relaxation.param === "fair_deal" || filter.item === relaxation.value)),
    }))
    .filter((relaxation) => relaxation.filter && relaxation.total > 0)
    .sort((a, b) => b.total - a.total)[0];

  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6 md:p-8 adult:rounded-lg">
      <h3 className="font-heading text-[1.375rem] font-semibold">
        No homes match all {filters.length} {filters.length === 1 ? "filter" : "filters"}
      </h3>
      <p className="text-ink-muted">Remove the filter that is ruling out the most homes, or clear them and start again.</p>
      {best?.filter ? (
        <Link href={searchHref({ ...search, selection: best.filter.without })} scroll={false} className={`${primaryButtonClass} inline-flex h-auto min-h-11 items-center py-2 no-underline`}>
          Remove &ldquo;{best.filter.label}&rdquo; to see {best.total} {noun(best.total)}
        </Link>
      ) : (
        <Link href={searchHref({ ...search, selection: NO_FILTERS })} scroll={false} className={`${primaryButtonClass} inline-flex h-auto min-h-11 items-center py-2 no-underline`}>
          Clear all filters
        </Link>
      )}
    </div>
  );
}

function SearchError({ status, detail }: { status: number; detail: string }) {
  const message = status === 400 ? detail : unavailableMessage(status);

  return (
    <Alert title={status === 400 ? "Please check your search" : "Search unavailable"}>{message}</Alert>
  );
}
