// components/card-result.tsx
import Link from "next/link";

export interface NursingHome {
  id: string;
  name: string;
  address: string;
  town: string;
  county: string;
  eircode: string;
  latestInspectionDate?: string;
}

interface CardResultProps {
  home: NursingHome;
}

export function CardResult({ home }: CardResultProps) {
  return (
    <article className="flex flex-col justify-between rounded-lg border border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-2">
        <h3 className="font-serif text-xl font-semibold tracking-tight text-ink">
          <Link
            href={`/centres/${home.id}`}
            className="hover:underline focus:outline-none focus:ring-2 focus:ring-link rounded"
          >
            {home.name}
          </Link>
        </h3>
        <p className="text-sm text-ink-muted">
          {home.address}, {home.town}, Co. {home.county}
          {home.eircode && ` • ${home.eircode}`}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line/50 pt-3 text-xs text-ink-muted">
        <span>
          {home.latestInspectionDate
            ? `Latest report: ${home.latestInspectionDate}`
            : "HIQA Registered"}
        </span>
        <Link
          href={`/centres/${home.id}`}
          className="font-medium text-link hover:underline"
        >
          View record &rarr;
        </Link>
      </div>
    </article>
  );
}