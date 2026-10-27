// components/layout/contacts-banner.tsx
// "Need to talk to someone?": a full-width band of brand colour pointing to the contacts page, on
// the resources page and at the end of the guides. className sets its margins for where it sits.
import Link from "next/link";
import { actionLinkClass, fullWidthClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";

export function ContactsBanner({ className = "" }: { className?: string }) {
  return (
    <section
      aria-labelledby="contacts-h"
      className={`${fullWidthClass} brand-band ${className}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8 md:py-14">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 id="contacts-h" className="flex items-center gap-3 font-heading text-2xl font-semibold text-ink md:text-4xl">
            <Icon name="talk" className="size-8 md:size-10" />
            Need to talk to someone?
          </h2>
          <p className="text-ink-muted md:text-lg">
            Our contacts page lists who to call about nursing home care: the regulator, the Fair Deal offices,
            complaints and advocacy.
          </p>
        </div>
        <Link href="/contacts" className={`${actionLinkClass} shrink-0`}>
          See contacts <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
