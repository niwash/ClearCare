// app/search/page.tsx
import { CardResult } from "@/components/search/card-result";
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

// Empty form fields arrive as "", which means "not set".
async function readQuery(searchParams: SearchPageProps["searchParams"]): Promise<SearchQuery> {
  const params = await searchParams;
  const query: SearchQuery = {};
  for (const key of [...FILTERS, "page", "page_size"] as const) {
    const value = params[key];
    const text = (Array.isArray(value) ? value[0] : value)?.trim();
    if (text) query[key] = text;
  }
  return query;
}

function hasFilters(query: SearchQuery) {
  return FILTERS.some((key) => query[key]);
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

function pageHref(query: SearchQuery, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, page: String(page) })) {
    if (value && !(key === "page" && value === "1")) params.set(key, value);
  }
  const search = params.toString();
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
  const result = await searchCentres(query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/home" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <span>Search</span>
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {hasFilters(query) ? `Results for ${describe(query)}` : "Find a nursing home"}
        </h1>
      </div>

      <SearchForm query={query} />

      {result.ok ? (
        <Results query={query} data={result.data} />
      ) : (
        <SearchError status={result.status} detail={result.detail} />
      )}
    </div>
  );
}

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-line bg-surface px-3 text-ink focus:outline-none focus:ring-2 focus:ring-link";

function SearchForm({ query }: { query: SearchQuery }) {
  return (
    <form action="/search" method="GET" role="search" aria-label="Find a nursing home" className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr]">
        <Field id="search-name" label="Name">
          <input id="search-name" name="name" type="search" defaultValue={query.name} maxLength={MAX_TEXT_LENGTH} className={inputClass} />
        </Field>
        <Field id="search-address" label="Address or town">
          <input id="search-address" name="address" type="search" defaultValue={query.address} maxLength={MAX_TEXT_LENGTH} className={inputClass} />
        </Field>
        <Field id="search-county" label="County">
          <select id="search-county" name="county" defaultValue={query.county ?? ""} className={inputClass}>
            <option value="">Any county</option>
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
            placeholder="D06 or W23 P6EX"
            autoComplete="postal-code"
            className={`${inputClass} uppercase placeholder:normal-case`}
          />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          className="h-11 rounded-md bg-link px-4 font-semibold text-surface transition-opacity hover:opacity-90"
        >
          Search
        </button>
        {hasFilters(query) && (
          <Link href="/search" className="text-sm">
            Clear search
          </Link>
        )}
      </div>
    </form>
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
        <div className="rounded-lg border border-line bg-surface p-8 text-ink-muted">
          <p className="font-medium text-ink">No registered centres match {describe(query)}.</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Check the spelling, or type the start of each word, e.g. &ldquo;elm&rdquo; for Elm Hall.</li>
            <li>&ldquo;St&rdquo; and &ldquo;Saint&rdquo; are searched separately, so try the other one.</li>
            <li>Many Dublin addresses don&apos;t include &ldquo;Dublin&rdquo;. Use the County filter instead.</li>
          </ul>
        </div>
      ) : centres.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-ink-muted">
          <p>
            There&apos;s no page {page}. <Link href={pageHref(query, 1)}>Go to the first page</Link>.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {total === centres.length
              ? `${total} registered ${total === 1 ? "centre" : "centres"}`
              : `Showing ${first}–${last} of ${total} registered centres`}
            , in alphabetical order.
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
          {page > 1 ? <Link href={pageHref(query, page - 1)}>&larr; Previous</Link> : <span />}
          <span className="text-ink-muted">
            Page {Math.min(page, lastPage)} of {lastPage}
          </span>
          {page < lastPage ? <Link href={pageHref(query, page + 1)}>Next &rarr;</Link> : <span />}
        </nav>
      )}

      <p className="text-xs text-ink-faint">
        Source:{" "}
        <a href={register_snapshot.url} className="text-ink-faint">
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
    <div role="alert" className="rounded-lg border border-not-compliant bg-surface p-5 text-sm">
      <p className="font-medium">{status === 400 ? "Please check your search" : "Search unavailable"}</p>
      <p className="mt-1 text-ink-muted">{message}</p>
    </div>
  );
}
