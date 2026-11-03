// components/centre/centre-amenities.tsx
// What the home offers, the last part of the details box on the centre page (CCARE-163). The values
// are what an AI tool read from one inspection report and are still being checked, so it says so,
// links to the report they came from, and shows the passages each one was read from: on hover or tap
// in the standard design (AmenityTags), in an accordion in the easier-to-read design.
import { ShowHide } from "@/components/ui/chevron";
import { formatDate, type AmenityItem, type CentreAmenities } from "@/lib/centres";
import type { ReactNode } from "react";
import { AmenityTags, Passages } from "./amenity-tags";

const tagClass = "rounded-full bg-tint-sage px-2.5 py-0.5 text-sm text-on-tint-sage adult:rounded-md";

type CentreAmenitiesProps = {
  amenities: CentreAmenities | null;
  // The PDF of the report they were read from, when ClearCare has it.
  reportUrl?: string;
};

// A section of the details box (CentreFacts), under a line, rather than a box of its own: one record.
export function CentreAmenitiesSection({ amenities, reportUrl }: CentreAmenitiesProps) {
  if (!amenities) {
    return (
      <section aria-labelledby="amenities-h" className="flex flex-col gap-1 border-t border-line-soft px-4 py-4">
        <Heading />
        <p className="text-ink-muted">
          We haven&apos;t read this home&apos;s care types and amenities from its reports yet. Ask the home what it
          offers.
        </p>
      </section>
    );
  }

  const report = amenities.inspection_date ? `the ${formatDate(amenities.inspection_date)} inspection report` : "an inspection report";
  const lists = [
    { label: "Types of care", items: amenities.care_types },
    { label: "Rooms", items: amenities.room_types },
    { label: "Activities", items: amenities.activities },
    { label: "Facilities", items: amenities.facilities },
  ];
  const found = lists.filter(({ items }) => items.length > 0);

  return (
    <section aria-labelledby="amenities-h" className="border-t border-line-soft py-2">
      <div className="flex flex-col gap-1 px-4 pb-2 pt-2">
        <Heading />
        {/* Said before the values, so nobody takes them as the home's own list. How to see the
            passages depends on the design, since each shows them its own way. */}
        <p className="text-small text-ink-muted">
          Read by an AI tool from {reportUrl ? <a href={reportUrl}>{report}</a> : report}. We&apos;re now checking
          these against the report, and the home may offer more than the report mentions, so ask the home about
          anything that matters to you.
          {found.length > 0 && (
            <>
              {" "}
              <span className="adult:hidden">Hover over or tap an item to see where the report says it.</span>
              <span className="hidden adult:inline">
                Open &ldquo;Where the report says this&rdquo; to see the passage each one was read from.
              </span>
            </>
          )}
        </p>
      </div>
      <dl>
        {lists.map(({ label, items }) => (
          <Row key={label} label={label}>
            {items.length === 0 ? (
              // Nothing the report clearly supports, which doesn't mean the home has none.
              <span className="text-ink-muted">None found in the report</span>
            ) : (
              <>
                <div className="adult:hidden">
                  <AmenityTags items={items} reportUrl={reportUrl} />
                </div>
                <ul className="hidden flex-wrap gap-1.5 adult:flex">
                  {items.map(({ item }) => (
                    <li key={item} className={tagClass}>
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Row>
        ))}
      </dl>
      {found.length > 0 && <Evidence lists={found} reportUrl={reportUrl} />}
    </section>
  );
}

function Heading() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 id="amenities-h" className="font-semibold text-ink">
        What the home offers
      </h3>
      {/* Outlined in the easier-to-read design, where the tints are all one sand colour and a filled
          label would look like one of the items. */}
      <span className="rounded-full bg-tint-gold px-2 py-0.5 text-xs font-semibold text-on-tint-gold adult:rounded-md adult:border adult:border-current adult:bg-transparent adult:text-sm">
        Read by AI
      </span>
    </div>
  );
}

// Laid out like the details' rows above it (Fact, centres/[id]/page.tsx), without the icons.
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-medium text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// The passages for every item at once, in the easier-to-read design only. Closed until opened, the
// same <details> pattern as the judgements chart (judgements-per-inspection.tsx).
function Evidence({ lists, reportUrl }: { lists: { label: string; items: AmenityItem[] }[]; reportUrl?: string }) {
  return (
    <details className="group mt-2 hidden border-t border-line-soft adult:block">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-ink">Where the report says this</span>
        <ShowHide />
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4">
        {lists.map(({ label, items }) => (
          <section key={label} className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-ink-muted">{label}</h4>
            <ul className="flex flex-col gap-3">
              {items.map(({ item, evidence }) => (
                <li key={item} className="flex flex-col gap-1">
                  <span className="font-medium text-ink">{item}</span>
                  <Passages evidence={evidence} reportUrl={reportUrl} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
