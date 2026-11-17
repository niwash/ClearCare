// components/search/view-switch.tsx
// The search results as a list of cards or as pins on a map (CCARE-229): the switch between the
// two, and what stands in the map's place when it can't be drawn. The view is in the page address
// (view=map), so both are links and work before scripts run. The switch is for screens too narrow
// for both: a wide one has the map beside the list whatever the view (CCARE-230), and the page
// leaves the switch out there.
import { actionLinkClass } from "@/components/ui/classes";
import { searchHref, type PageSearch } from "@/lib/page-search";
import Link from "next/link";

const VIEWS = [
  { view: "list", label: "List" },
  { view: "map", label: "Map" },
] as const;

export function ViewSwitch({ search }: { search: PageSearch }) {
  return (
    <nav aria-label="Show the results as" className="inline-flex rounded-full border border-field bg-surface p-0.5 adult:rounded-md">
      {VIEWS.map(({ view, label }) => {
        const current = search.view === view;
        return (
          <Link
            key={view}
            // To the first page: the map has no pages, and the list starts again from the top.
            href={searchHref({ ...search, view })}
            scroll={false}
            aria-current={current ? "true" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold no-underline adult:rounded ${current ? "bg-primary text-on-primary hover:text-on-primary" : "text-ink hover:bg-surface-muted"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// In the map's place, in the look of the page's other panels that say nothing was found: it isn't a
// fault in the search, and the list still has every home. located: the points were read, and none of
// these homes has one. A status, as it can take the map's place after the page has loaded.
//
// Without listHref it is the map of every home, shown before anything is searched, that failed in
// the browser. There is no list of results to point to then, so it says only that there is no map.
//
// listBeside: it stands where the map of a search's results would, which a wide screen has beside
// the list (CCARE-230). The list is in view there, so the link is for narrower screens.
export function MapUnavailable({ listHref, located = false, listBeside = false }: { listHref?: string; located?: boolean; listBeside?: boolean }) {
  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-2xl bg-band p-6 md:p-8 adult:rounded-lg">
      <p className="font-heading text-xl font-semibold text-ink md:text-2xl">
        {located ? "No map locations for these nursing homes yet" : "The map isn't available at the moment"}
      </p>
      {listHref && (
        <>
          <p className="text-ink-muted">
            {located ? "ClearCare has no map location for the nursing homes this search found." : "The nursing homes this search found are still in the list."}
          </p>
          <Link href={listHref} scroll={false} className={`${actionLinkClass} mt-2 ${listBeside ? "xl:hidden" : ""}`}>
            Show them as a list <span aria-hidden>→</span>
          </Link>
        </>
      )}
    </div>
  );
}
