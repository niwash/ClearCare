// components/home/fair-deal-band.tsx
// Paying for nursing home care, in a band of its own the full width of the window (CCARE-278): in
// user testing (P2_3) the participant didn't notice Fair Deal when they started to search, though it
// was the second slide of the carousel and one card among the features. Straight after the search,
// above the features, so a family meets the cost as soon as they start. In the words of the choosing guide
// (guides/choosing-a-nursing-home), so the site says what Fair Deal is one way.
//
// The words on the left and the buttons on the right from desktop width, as in the band at the foot
// of the page; stacked on smaller screens. The warm gold of the site's notes about money and care.
// The adult-centred design turns the tint to its band colour.
import Link from "next/link";
import { actionLinkClass, fullWidthClass, secondaryLinkClass } from "@/components/ui/classes";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";

export function FairDealBand() {
  return (
    <section aria-labelledby="paying-h" className={`${fullWidthClass} bg-tint-gold py-10 md:py-12`}>
      <div className="reveal page-column flex flex-col gap-6 px-4 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="flex max-w-3xl items-start gap-4">
          {/* On the surface colour, so the circle shows against the gold band. */}
          <IconCircle path={ICON_PATHS.cost} size="large" tint="gold" className="bg-surface!" />
          <div className="flex flex-col gap-2">
            <h2 id="paying-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
              Paying for nursing home care
            </h2>
            <p className="text-ink md:text-lg">
              Fair Deal is the government scheme that helps pay for nursing home care. You pay a contribution based on
              your income and what you own, and the State pays the rest.
            </p>
          </div>
        </div>
        {/* The calculator beside the guide, as the second choice (CCARE-237): side by side when they fit,
            the calculator under the guide on narrow phones. */}
        <div className="flex shrink-0 flex-wrap gap-3 self-start lg:self-center">
          <Link href="/guides/fair-deal" className={actionLinkClass}>
            How Fair Deal works <span aria-hidden>→</span>
          </Link>
          <Link href="/guides/fair-deal/calculator" className={secondaryLinkClass}>
            Estimate your contribution <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
