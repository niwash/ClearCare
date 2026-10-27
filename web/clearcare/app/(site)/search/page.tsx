// app/search/page.tsx
import { Alert } from "@/components/layout/alert";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { CardResult } from "@/components/search/card-result";
import { actionLinkClass, comingSoonClass, fullWidthClass, primaryButtonClass, textInputClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";
import { formatDate } from "@/lib/centres";
import {
  COUNTIES,
  looksLikeEircode,
  MAX_TEXT_LENGTH,
  searchCentres,
  unavailableMessage,
  type SearchQuery,
  type SearchResponse,
} from "@/lib/search";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FILTERS = ["name", "address", "county", "eircode"] as const;

// Filters the API can't apply yet, shown so people know they're on the way.
// TODO: Make these real filters once the API has the data.
const COMING_SOON_FILTERS = ["Care types", "Services", "Amenities"] as const;

// The results grid has 1, 2 or 3 columns depending on screen width. 24 divides by all three, so
// every full page fills its last row. The API's default of 20 would leave gaps.
const RESULTS_PER_PAGE = "24";

// The county list's "Any county": its own value, so the blank the list starts on is the only
// option chosen when the page opens. It means no county, like the blank.
const ANY_COUNTY = "any";

// Empty form fields arrive as "", which means "not set"; so does "Any county".
async function readQuery(searchParams: SearchPageProps["searchParams"]): Promise<SearchQuery> {
  const params = await searchParams;
  const query: SearchQuery = {};
  for (const key of [...FILTERS, "page", "page_size"] as const) {
    const value = params[key];
    const text = (Array.isArray(value) ? value[0] : value)?.trim();
    if (text && !(key === "county" && text === ANY_COUNTY)) query[key] = text;
  }
  return query;
}

function hasFilters(query: SearchQuery) {
  return FILTERS.some((key) => query[key]);
}

// The form was sent with every field empty: its fields arrive as "", so the keys are there.
async function sentEmpty(searchParams: SearchPageProps["searchParams"]) {
  const params = await searchParams;
  return FILTERS.some((key) => key in params);
}

// "“aras” in Co. Mayo", for the heading and the empty state.
function describe(query: SearchQuery) {
  const parts = [
    query.name && `“${query.name}”`,
    query.address && `address or town “${query.address}”`,
    query.county && `Co. ${query.county}`,
    query.eircode && `Eircode ${query.eircode.toUpperCase()}`,
  ].filter(Boolean);
  return parts.join(", ");
}

function pageQuery(query: SearchQuery, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, page: String(page) })) {
    if (value && !(key === "page" && value === "1")) params.set(key, value);
  }
  return params.toString();
}

function pageHref(query: SearchQuery, page: number) {
  const search = pageQuery(query, page);
  return search ? `/search?${search}` : "/search";
}

// The home page box sends q. The API has no combined search, so send it on as an Eircode
// if it looks like one, otherwise as a name.
async function redirectHomeSearch(searchParams: SearchPageProps["searchParams"]) {
  const value = (await searchParams).q;
  if (value === undefined) return;
  const q = (Array.isArray(value) ? value[0] : value)?.trim();
  if (!q) redirect("/search");
  redirect(`/search?${new URLSearchParams({ [looksLikeEircode(q) ? "eircode" : "name"]: q })}`);
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const query = await readQuery(searchParams);
  return { title: hasFilters(query) ? `Search results for ${describe(query)}` : "Find a nursing home" };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  await redirectHomeSearch(searchParams);
  const query = await readQuery(searchParams);
  // Nothing is listed until something is searched for (CCARE-164): a full list of every home
  // read as if the search had been done for them.
  const searched = hasFilters(query);
  // Not added to query itself, so it stays out of the page links.
  const result = searched ? await searchCentres({ ...query, page_size: query.page_size ?? RESULTS_PER_PAGE }) : null;

  return (
    <>
      <SearchHero query={query} />

      <SearchForm query={query} />

      {result === null ? (
        <SearchPrompt empty={await sentEmpty(searchParams)} />
      ) : result.ok ? (
        <Results query={query} data={result.data} />
      ) : (
        <SearchError status={result.status} detail={result.detail} />
      )}

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}


// The top of the page, flush under the header as on the resources page: the heading and a line of
// welcome on a band of brand colour (brand-band, globals.css). The search form sits under it.
function SearchHero({ query }: { query: SearchQuery }) {
  const searched = hasFilters(query);

  return (
    <section aria-labelledby="search-h" className={`${fullWidthClass} brand-band -mt-6 md:-mt-10`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        <div className="flex flex-col items-start gap-3">
          <Breadcrumb trail={[]} current="Search for Homes" />
          <h1 id="search-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-5xl">
            {searched ? `Results for ${describe(query)}` : "Find a nursing home"}
          </h1>
          {!searched && (
            <p className="max-w-2xl text-ink-muted md:text-lg">
              Search every nursing home registered with HIQA. Each one has a page with its inspection reports over
              time. We don&apos;t rate or recommend homes, or show free beds.
            </p>
          )}
        </div>

        {!searched && (
          <p className="text-sm text-ink-muted">
            Not sure where to start?{" "}
            <Link href="/guides/user-journey" className="text-ink tap-target">
              Read how a family chooses a nursing home →
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

const inputClass = `${textInputClass} w-full`;

function SearchForm({ query }: { query: SearchQuery }) {
  return (
    <form action="/search" method="GET" role="search" aria-label="Find a nursing home" className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr]">
        <Field id="search-name" label="Nursing home name">
          {/* No faded example in any field: people read one as already filled in (CCARE-164). */}
          <input
            id="search-name"
            name="name"
            type="search"
            defaultValue={query.name}
            maxLength={MAX_TEXT_LENGTH}
            className={inputClass}
          />
        </Field>
        <Field id="search-address" label="Address or town">
          <input
            id="search-address"
            name="address"
            type="search"
            defaultValue={query.address}
            maxLength={MAX_TEXT_LENGTH}
            className={inputClass}
          />
        </Field>
        <Field id="search-county" label="County">
          <select id="search-county" name="county" defaultValue={query.county ?? ""} className={inputClass}>
            {/* The box starts blank, so nothing looks chosen (CCARE-164). The blank is hidden from the
                list, so "Any county" is the one to pick; both search every county (readQuery). */}
            <option value="" hidden></option>
            <option value={ANY_COUNTY}>Any county</option>
            {COUNTIES.map((county) => (
              <option key={county} value={county}>
                {county}
              </option>
            ))}
          </select>
        </Field>
        <Field id="search-eircode" label="Eircode">
          <input
            id="search-eircode"
            name="eircode"
            type="search"
            defaultValue={query.eircode}
            autoComplete="postal-code"
            className={`${inputClass} uppercase`}
          />
        </Field>
      </div>
      <ComingSoonFilters />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          className={primaryButtonClass}
        >
          Search
        </button>
        {hasFilters(query) && (
          <Link href="/search" className="inline-block py-1 text-sm tap-target">
            Clear search
          </Link>
        )}
      </div>
    </form>
  );
}

// Each looks like a closed dropdown, with the dashed look of other unfinished features. They do
// nothing, and aren't form fields, so they never reach the search.
function ComingSoonFilters() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {COMING_SOON_FILTERS.map((label) => (
        <div key={label} className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-muted">{label}</span>
          <button
            type="button"
            aria-disabled="true"
            title="Coming soon"
            className={`flex h-11 items-center justify-between gap-2 px-3 text-left ${comingSoonClass}`}
          >
            <span>
              <span className="sr-only">Filter by {label.toLowerCase()} </span>Coming soon
            </span>
            <span aria-hidden>▾</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

// In place of results before anything is searched for: what to enter, in a tinted panel like the
// no-results one. If the form was sent empty, it says so first.
function SearchPrompt({ empty }: { empty: boolean }) {
  return (
    <section aria-labelledby="prompt-h" className="flex flex-col items-start gap-3 rounded-lg bg-band p-6 md:p-8">
      <h2 id="prompt-h" className="flex items-center gap-3 font-heading text-xl font-semibold text-ink md:text-2xl">
        <Icon name="search" className="size-6 text-primary" />
        {empty ? "Please enter something to search for" : "Find a nursing home"}
      </h2>
      <p className="max-w-2xl text-ink-muted">
        Search by name, address or town, county or Eircode.
      </p>
    </section>
  );
}

function Results({ query, data }: { query: SearchQuery; data: SearchResponse }) {
  const { centres, page, page_size, total, register_snapshot } = data;
  const first = (page - 1) * page_size + 1;
  const last = first + centres.length - 1;
  const lastPage = Math.max(1, Math.ceil(total / page_size));

  return (
    <section aria-labelledby="results-h" className="flex flex-col gap-4">
      <h2 id="results-h" className="sr-only">
        Results
      </h2>

      {total === 0 ? (
        // In a tinted panel like the resources page's official information, with a way back to every
        // home, so a search that finds nothing isn't a dead end.
        <div className="flex flex-col items-start gap-3 rounded-lg bg-band p-6 md:p-8">
          <p className="font-heading text-xl font-semibold text-ink md:text-2xl">
            We couldn&apos;t find a registered home matching {describe(query)}
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
      ) : centres.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-band p-6 md:p-8">
          <p className="text-ink-muted">There&apos;s no page {page} for this search.</p>
          <Link href={pageHref(query, 1)} className={actionLinkClass}>
            Go to the first page <span aria-hidden>→</span>
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {total === centres.length
              ? `${total} registered ${total === 1 ? "centre" : "centres"}`
              : `Showing ${first}–${last} of ${total} registered centres`}
            .
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {centres.map((centre) => (
              <CardResult key={centre.centre_id} centre={centre} />
            ))}
          </div>
        </>
      )}

      {lastPage > 1 && (
        <nav aria-label="Result pages" className="flex items-center justify-between gap-4 text-sm">
          {page > 1 ? <Link href={pageHref(query, page - 1)} className="tap-target">&larr; Previous</Link> : <span />}
          <span className="text-ink-muted">
            Page {Math.min(page, lastPage)} of {lastPage}
          </span>
          {page < lastPage ? <Link href={pageHref(query, page + 1)} className="tap-target">Next &rarr;</Link> : <span />}
        </nav>
      )}

      <p className="text-xs text-ink-faint">
        Source:{" "}
        <a href={register_snapshot.url} className="text-ink-faint adult:text-primary">
          HIQA register
        </a>
        , downloaded {formatDate(register_snapshot.fetched_at)}.
      </p>
    </section>
  );
}

function SearchError({ status, detail }: { status: number; detail: string }) {
  const message = status === 400 ? detail : unavailableMessage(status);

  return (
    <Alert title={status === 400 ? "Please check your search" : "Search unavailable"}>{message}</Alert>
  );
}
