// components/card-result.tsx
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
  const eircode = centre.eircode ? formatEircode(centre.eircode) : null;
  // The address often ends with the Eircode already.
  let address = addressWithoutName(centre);
  if (eircode && address.endsWith(eircode)) address = address.slice(0, -eircode.length).replace(/,\s*$/, "");

  return (
    <article className="flex flex-col justify-between rounded-lg border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-2">
        <h3 className="font-serif text-xl font-semibold tracking-tight text-ink">
          <Link
            href={`/centres/${centre.centre_id}`}
            className="rounded hover:underline focus:outline-none focus:ring-2 focus:ring-link"
          >
            {centre.centre_name}
          </Link>
        </h3>
        <p className="text-sm text-ink-muted">
          {address}, Co. {centre.county}
          {eircode && (
            <>
              {" "}
              · <span className="whitespace-nowrap font-mono">{eircode}</span>
            </>
          )}
        </p>
        {centre.maximum_occupancy !== null && (
          // The most residents HIQA allows, not free beds.
          <p className="text-sm text-ink-muted">Registered for up to {centre.maximum_occupancy} residents</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/50 pt-3 text-xs text-ink-muted">
        <a href={centre.hiqa_url} target="_blank" rel="noopener noreferrer">
          HIQA register entry<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <Link href={`/centres/${centre.centre_id}`} className="font-medium text-link hover:underline">
          View record &rarr;
        </Link>
      </div>
    </article>
  );
}
