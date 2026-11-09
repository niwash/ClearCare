// components/search/card-result.tsx
// One search result (CCARE-189): the home's name, where it is, its size and Fair Deal, a button to
// shortlist it, a tick for each chosen filter it meets, and the date of its latest inspection. The
// filter ticks, Fair Deal and the inspection come from an API with the filters (lib/search.ts);
// before that, the card has the name, place and size.
import { CompareButton } from "@/components/compare/compare-button";
import { formatDate } from "@/lib/centres";
import { asEircode } from "@/lib/eircode";
import type { CentreSummary } from "@/lib/search";
import { matchedLabels, type FilterSelection } from "@/lib/search-filters";
import Link from "next/link";

interface CardResultProps {
  centre: CentreSummary;
  selection: FilterSelection;
}

// The town: the register has no field for it, so it's the address's last part that isn't the
// Eircode or the county. The address usually starts with the centre's name, which the card already
// shows. A part that asEircode reads as the centre's Eircode is its Eircode: the register prints
// two with a letter O for 0 (A98 C2CO), and the database holds them with the 0.
function town({ centre_name, address, eircode, county }: CentreSummary) {
  const prefix = `${centre_name},`.toLowerCase();
  const rest = address.toLowerCase().startsWith(prefix) ? address.slice(prefix.length) : address;
  const parts = rest
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !(eircode && asEircode(part) === eircode) && !new RegExp(`^(co\\.?|county)\\s+${county}$`, "i").test(part) && part.toLowerCase() !== county.toLowerCase());
  return parts.at(-1) ?? null;
}

export function CardResult({ centre, selection }: CardResultProps) {
  const href = `/centres/${centre.centre_id}`;
  const place = [town(centre), `Co. ${centre.county}`].filter(Boolean).join(", ");
  const facts = [
    place,
    // The most residents HIQA allows, not free beds; the register calls them residents.
    centre.maximum_occupancy !== null && `${centre.maximum_occupancy} residents`,
    centre.fair_deal && "Fair Deal",
  ].filter(Boolean);
  const ticks = matchedLabels(selection, centre.amenities);
  const inspection = centre.latest_inspection;

  return (
    <article className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-5 md:px-6 md:py-5.5 adult:rounded-lg">
      {/* The shortlist button beside the name, or under it where the card is narrow. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-xl font-semibold md:text-[1.3125rem]">
            <Link href={href} className="text-ink no-underline hover:underline tap-target-top">
              {centre.centre_name}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-ink-muted">{facts.join(" · ")}</p>
        </div>
        <CompareButton home={{ id: centre.centre_id, name: centre.centre_name }} variant="result" className="" />
      </div>

      {ticks.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul aria-label="Matches your filters" className="flex flex-wrap gap-2">
            {ticks.map((label) => (
              <li key={label} className="inline-flex items-center gap-1.5 rounded-lg bg-tint-blue px-2.5 py-1 text-sm font-semibold text-on-tint-blue adult:rounded-md">
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {label}
              </li>
            ))}
          </ul>
          {/* Which report the ticks were read from: it can be older than the latest inspection below,
              as the newest report may not have been read yet. The link goes to the centre page's
              "What the home offers", with the passages behind each item. */}
          <p className="text-sm text-ink-muted">
            <Link href={`${href}#amenities-h`}>
              {centre.amenities?.inspection_date
                ? `From the ${formatDate(centre.amenities.inspection_date)} inspection report`
                : "From its inspection report"}
            </Link>
            , read by an AI tool
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-line-soft pt-3.5 text-sm text-ink-muted">
        {/* The date only, with no compliance count: inspections judge different sets of regulations,
            so a count would read as a score that can't be compared between homes, and ClearCare
            doesn't rank homes. */}
        {inspection && (
          <span>
            Latest HIQA inspection:{" "}
            <strong className="text-ink">{inspection.date ? formatDate(inspection.date) : "date not given"}</strong>
          </span>
        )}
        <Link href={`${href}#history`} className="font-semibold md:ml-auto">
          View inspections →
        </Link>
      </div>
    </article>
  );
}
