// components/home/site-features.tsx
// What the site offers, as four cards on a soft band: an icon in its own soft colour, a heading,
// a line spoken to the reader and an arrow, the whole card a link to its page (CCARE-179).
import Link from "next/link";
import { fullWidthClass } from "@/components/ui/classes";
import { IconCircle, type Tint } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";

// The four things the site has, as the home page listed them before CCARE-179, in its new cards.
const FEATURES: { title: string; text: string; href: string; icon: string; tint: Tint }[] = [
  {
    title: "Nursing home records",
    text: "Each home's HIQA inspection reports, over time.",
    href: "/search",
    icon: ICON_PATHS.search,
    tint: "blue",
  },
  {
    title: "Step-by-step guides",
    text: "How a family chooses a home, and what to ask when you visit.",
    href: "/resources",
    icon: ICON_PATHS.guides,
    tint: "sage",
  },
  {
    title: "Fair Deal explained",
    text: "How the scheme works, who qualifies and how to apply.",
    href: "/guides/fair-deal",
    icon: ICON_PATHS.cost,
    tint: "gold",
  },
  {
    title: "Who to contact",
    text: "Helplines, advocacy and the offices that handle Fair Deal.",
    href: "/contacts",
    icon: ICON_PATHS.phone,
    tint: "rose",
  },
];

export function SiteFeatures() {
  return (
    <section aria-labelledby="help-h" className={`${fullWidthClass} bg-band px-4 py-10 md:px-8 md:py-14`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <h2
          id="help-h"
          className="text-center font-heading text-2xl font-semibold tracking-tight md:text-3xl adult:text-left"
        >
          How can ClearCare help you today?
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <li key={feature.href}>
              <Link
                href={feature.href}
                className="group flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-6 text-ink no-underline shadow-sm transition-shadow hover:border-primary hover:text-ink hover:shadow-md adult:shadow-none adult:transition-none"
              >
                <IconCircle path={feature.icon} size="large" tint={feature.tint} />
                <h3 className="font-heading text-xl font-semibold text-ink group-hover:underline">{feature.title}</h3>
                <p className="text-ink-muted">{feature.text}</p>
                <span aria-hidden className="mt-auto pt-2 text-lg text-primary">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
