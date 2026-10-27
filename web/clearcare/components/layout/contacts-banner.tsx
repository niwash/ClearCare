// components/layout/contacts-banner.tsx
// "Need to talk to someone?": a full-width strip of brand colour pointing to the contacts page, on
// the resources page and at the end of the guides. Kept to one row from tablet width up, as most
// pages end with it under a band of guides (CCARE-164: less scrolling). className sets its margins
// for where it sits.
import Link from "next/link";
import { actionLinkClass, fullWidthClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";

export function ContactsBanner({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="contacts-h" className={`${fullWidthClass} brand-band ${className}`}>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-6">
        <div className="flex items-center gap-4">
          <Icon name="talk" className="size-8 md:size-10" />
          <div className="flex flex-col">
            <h2 id="contacts-h" className="font-heading text-xl font-semibold text-ink md:text-2xl">
              Need to talk to someone?
            </h2>
            <p className="text-ink-muted">Who to call about nursing home care, Fair Deal, complaints and advocacy.</p>
          </div>
        </div>
        <Link href="/contacts" className={`${actionLinkClass} shrink-0`}>
          See contacts <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
