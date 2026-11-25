// app/(site)/nursing-homes/[county]/page.tsx
// A county's page, /nursing-homes/cork (CCARE-303, CCARE-297): the search for that county alone,
// drawn by the search page with the county read from the address. A page of its own rather than a
// rewrite to /search, so that reached by a link it gets its own title and canonical: behind a
// rewrite, every county was the /search route to the browser, and the router reused whichever head
// it already had for it (PR #242 review). at=county tells the search page it was reached this way,
// so it doesn't send the visitor on to the address they're already at, and answers an unknown
// county with a 404 (app/(site)/search/page.tsx). Anything else in the query, such as ?page=2,
// is kept.
import SearchPage, { generateMetadata as searchMetadata } from "../../search/page";

type CountyPageProps = {
  params: Promise<{ county: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function countySearch({ params, searchParams }: CountyPageProps) {
  const [{ county }, query] = await Promise.all([params, searchParams]);
  return { ...query, county, at: "county" };
}

export async function generateMetadata(props: CountyPageProps) {
  return searchMetadata({ searchParams: countySearch(props) });
}

export default function CountyPage(props: CountyPageProps) {
  return <SearchPage searchParams={countySearch(props)} />;
}
