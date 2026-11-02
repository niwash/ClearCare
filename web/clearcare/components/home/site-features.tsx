// components/home/site-features.tsx
// What the site offers, as four cards: an icon in its own soft colour, a heading, a line spoken to
// the reader and an arrow, the whole card a link to its page (CCARE-179). On the page's own
// background, as the hero's band sits just above. Each card lifts on hover and its arrow moves on,
// so it's clear the whole card can be chosen.
import Link from "next/link";
import { linkCardClass } from "@/components/ui/classes";
import { IconCircle, type Tint } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";

// The four things the site has, as the home page listed them before CCARE-179, in its new cards.
const FEATURES: { title: string; text: string; href: string; icon: string; tint: Tint }[] = [
  {
    title: "Nursing home records",
    text: "A home's HIQA inspection reports, brought together on one page.",
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
    <section aria-labelledby="help-h" className="reveal flex flex-col gap-8 py-4 md:py-6">
      <div className="flex flex-col items-center gap-3 text-center adult:items-start adult:text-left">
        <h2 id="help-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          How can ClearCare help you today?
        </h2>
        <span aria-hidden className="h-1 w-12 rounded-full bg-accent" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <li key={feature.href}>
            <Link href={feature.href} className={`${linkCardClass} flex h-full flex-col gap-3 p-6`}>
              <IconCircle path={feature.icon} size="large" tint={feature.tint} />
              <h3 className="font-heading text-xl font-semibold text-ink group-hover:underline">{feature.title}</h3>
              <p className="text-ink-muted">{feature.text}</p>
              <span
                aria-hidden
                className="mt-auto pt-2 text-lg text-primary transition-transform group-hover:translate-x-1.5 motion-reduce:transition-none adult:transition-none adult:group-hover:translate-x-0"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
