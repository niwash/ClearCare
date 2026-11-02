// components/layout/contacts-banner.tsx
// "Need to talk to someone?": a full-width strip pointing to the contacts page, on the resources
// page and at the end of the guides. In the warm band colour, with the icon in the rose tint, as
// it offers a person to talk to rather than more to read (CCARE-179). Kept to one row from tablet
// width up, as most pages end with it under a band of guides (CCARE-164: less scrolling).
// className sets its margins for where it sits.
import Link from "next/link";
import { actionLinkClass, fullWidthClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";

export function ContactsBanner({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="contacts-h" className={`${fullWidthClass} bg-warm ${className}`}>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-4">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-tint-rose text-on-tint-rose md:size-14 adult:bg-surface">
            <Icon name="talk" className="size-6 md:size-7" />
          </span>
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
