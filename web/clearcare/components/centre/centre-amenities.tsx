// components/centre/centre-amenities.tsx
// What the home offers (CCARE-163), a section of the record's overview of its own (CCARE-212). The values
// are what an AI tool read from one inspection report and are still being checked, so it says so,
// links to the report they came from, and shows the passages each one was read from: on hover or tap
// in the standard design (AmenityTags), in an accordion in the easier-to-read design. Each list is
// a card of its own.
import { ShowHide } from "@/components/ui/chevron";
import { Icon } from "@/components/ui/icons";
import { sectionCardClass, sectionHeadingClass } from "./section-icon";
import { formatDate, type AmenityItem, type CentreAmenities } from "@/lib/centres";
import type { ReactNode } from "react";
import { AmenityIcon } from "./amenity-icon";
import { AmenityTags, Passages } from "./amenity-tags";

// Shared with Compare Homes, so an item looks the same in both places.
export const amenityTagClass = "rounded-full bg-tint-sage px-2.5 py-0.5 text-sm text-on-tint-sage adult:rounded-md";

type CentreAmenitiesProps = {
  amenities: CentreAmenities | null;
  // The PDF of the report they were read from, when ClearCare has it.
  reportUrl?: string;
};

// A section of the overview of its own (CCARE-212): its heading and note on the band, each list on a
// card of its own, as in "About this home". It was the last part of the details box, which made
// that box long beside the photo and the actions.
export function CentreAmenitiesSection({ amenities, reportUrl }: CentreAmenitiesProps) {
  if (!amenities) {
    return (
      <section id="offers" aria-labelledby="amenities-h" className="flex flex-col gap-3">
        <Heading />
        <p className={`${sectionCardClass} p-6 text-ink-muted`}>
          We haven&apos;t read this home&apos;s care types and amenities from its reports yet. Ask the home what it
          offers.
        </p>
      </section>
    );
  }

  const report = amenities.inspection_date ? `the ${formatDate(amenities.inspection_date)} inspection report` : "an inspection report";
  // Each list's card heading has a picture: one of the list's own amenity icons, or the home for the
  // types of care, which have no icons yet.
  const lists = [
    { label: "Types of care", items: amenities.care_types, icon: <Icon name="home" className="size-4" /> },
    { label: "Rooms", items: amenities.room_types, icon: <AmenityIcon item="Single room" className="size-4" /> },
    { label: "Activities", items: amenities.activities, icon: <AmenityIcon item="Music and singing" className="size-4" /> },
    { label: "Facilities", items: amenities.facilities, icon: <AmenityIcon item="Lounge/day room" className="size-4" /> },
  ];
  const found = lists.filter(({ items }) => items.length > 0);

  return (
    <section id="offers" aria-labelledby="amenities-h" className="flex flex-col gap-3">
      <Heading />
      {/* Said before the values, so nobody takes them as the home's own list; the first sentence is
          the disclosure the AI Act (Art. 50(4)) and the CC BY licence ask for, so it stays. How to see
          the passages depends on the design, since each shows them its own way. */}
      <p className="max-w-3xl text-ink">
        Read by an AI tool from {reportUrl ? <a href={reportUrl}>{report}</a> : report}. We&apos;re now checking
        these against the report, and the home may offer more than the report mentions, so always call the home
        to confirm anything that matters to you.
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
      {/* A card for each list, two to a row from md up, like the cards of "About this home". */}
      <div className="grid gap-4 md:grid-cols-2">
        {lists.map(({ label, items, icon }) => (
          <ListCard key={label} label={label} icon={icon}>
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
                    <li key={item} className={`${amenityTagClass} inline-flex items-center gap-1.5`}>
                      <AmenityIcon item={item} />
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </ListCard>
        ))}
      </div>
      {found.length > 0 && <Evidence lists={found} reportUrl={reportUrl} />}
    </section>
  );
}

function Heading() {
  return (
    <h2 id="amenities-h" className={sectionHeadingClass}>
      What the home offers
    </h2>
  );
}

// One list on a card of its own, with the same heading as the cards of "About this home" above it
// (FactCard, centres/[id]/page.tsx).
function ListCard({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} className={`${sectionCardClass} flex flex-col gap-3 p-4 md:p-5`}>
      <h3 className="flex items-center gap-2 font-semibold text-ink">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-tint-sage text-on-tint-sage adult:bg-surface-muted adult:text-ink">
          {icon}
        </span>
        {label}
      </h3>
      <div>{children}</div>
    </section>
  );
}

// The passages for every item at once, in the easier-to-read design only. Closed until opened, the
// same <details> pattern as the judgements chart (judgements-per-inspection.tsx).
function Evidence({ lists, reportUrl }: { lists: { label: string; items: AmenityItem[] }[]; reportUrl?: string }) {
  return (
    <details className={`${sectionCardClass} group hidden adult:block`}>
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
