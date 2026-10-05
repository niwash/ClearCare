// app/search/page.tsx
import { CardResult, NursingHome } from "@/components/card-result";
import Link from "next/link";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return {
    title: q ? `Search results for "${q}"` : "Search Nursing Homes",
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() || "";

  // TODO: Replace with actual data
  const results: NursingHome[] = query
    ? [
        {
          id: "1",
          name: "Nursing home 1",
          address: "Random home street",
          town: "Ballina",
          county: "Mayo",
          eircode: "F26 X2P1",
          latestInspectionDate: "12 May 2025",
        },
        {
          id: "2",
          name: "Nursing home 2",
          address: "Ballina",
          town: "Ballina",
          county: "Mayo",
          eircode: "F26 X2P1",
          latestInspectionDate: "12 May 2025",
        },
        {
          id: "3",
          name: "Nursing home 3",
          address: "Random street 3",
          town: "Ballina",
          county: "Mayo",
          eircode: "F26 X2P1",
          latestInspectionDate: "12 May 2025",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>/</span>
          <span>Search</span>
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {query ? `Results for "${query}"` : "Search Nursing Homes"}
        </h1>
        <p className="text-sm text-ink-muted">
          Found {results.length} registered {results.length === 1 ? "centre" : "centres"}.
        </p>
      </div>

      {/* Inline Search Bar */}
      <form action="/search" method="GET" role="search" className="flex max-w-xl gap-2">
        <label htmlFor="search-input" className="sr-only">
          Search nursing homes
        </label>
        <input
          id="search-input"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Name, town or Eircode"
          className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-ink focus:outline-none focus:ring-2 focus:ring-link"
        />
        <button
          type="submit"
          className="h-11 rounded-md bg-link px-4 font-semibold text-surface hover:opacity-90 transition-opacity"
        >
          Search
        </button>
      </form>

      {/* Results Grid */}
      {results.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-2">
          {results.map((home) => (
            <CardResult key={home.id} home={home} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-ink-muted mt-2">
          {query ? (
            <p>No nursing homes found matching &quot;{query}&quot;.</p>
          ) : (
            <p>Please enter a search term above to find a nursing home.</p>
          )}
        </div>
      )}
    </div>
  );
}