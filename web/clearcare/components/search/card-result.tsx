// components/search/card-result.tsx
import { CompareButton } from "@/components/compare/compare-button";
import { Icon } from "@/components/ui/icons";
import { formatEircode, type CentreSummary } from "@/lib/search";
import Link from "next/link";

interface CardResultProps {
  centre: CentreSummary;
}

// The register's address usually starts with the centre's name, which the card already shows.
function addressWithoutName({ centre_name, address }: CentreSummary) {
  const prefix = `${centre_name},`.toLowerCase();
  return address.toLowerCase().startsWith(prefix) ? address.slice(prefix.length).trim() : address;
}

export function CardResult({ centre }: CardResultProps) {
  const href = `/centres/${centre.centre_id}`;
  const eircode = centre.eircode ? formatEircode(centre.eircode) : null;
  // The address often ends with the Eircode already.
  let address = addressWithoutName(centre);
  if (eircode && address.endsWith(eircode)) address = address.slice(0, -eircode.length).replace(/,\s*$/, "");

  return (
    <article className="flex flex-col justify-between rounded-lg border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-xl font-semibold tracking-tight text-ink">
          <Link
            href={href}
            className="rounded hover:underline focus:outline-none focus:ring-2 focus:ring-primary tap-target-top"
          >
            {centre.centre_name}
          </Link>
        </h3>
        {/* One part per line, as on an envelope: the street and town, the county, then the Eircode. */}
        <div className="flex gap-2 text-sm text-ink-muted">
          <Icon name="address" className="mt-0.5 size-4" />
          <p className="flex flex-col">
            <span>{address}</span>
            <span>Co. {centre.county}</span>
            {eircode && <span className="font-mono">{eircode}</span>}
          </p>
        </div>
        {centre.maximum_occupancy !== null && (
          // The most residents HIQA allows, not free beds.
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Icon name="beds" />
            Registered for up to {centre.maximum_occupancy} residents
          </p>
        )}
      </div>

      {/* Add to shortlist on the left, View record on the right. In the adult-centred design the larger
          text doesn't fit on one line, so the link wraps under the button rather than either label
          breaking mid-way. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line/50 pt-3 text-xs text-ink-muted adult:border-line-soft">
        {/* Replaces the "Add to list (coming soon)" placeholder for CCARE-46 (CCARE-127). */}
        <CompareButton
          home={{ id: centre.centre_id, name: centre.centre_name }}
          className="min-h-11 px-3 text-sm adult:whitespace-nowrap"
        />
        <Link
          href={href}
          className="inline-block py-1 font-medium text-primary hover:underline tap-target adult:whitespace-nowrap"
        >
          View record &rarr;
        </Link>
      </div>
    </article>
  );
}
