// components/home/site-features.tsx
// What the site offers, side by side: an icon, a heading and a line each, every one a link to its
// page. Unlike the carousel above, all four show at once.
import Link from "next/link";
import { IconCircle } from "@/components/ui/icon-circle";
import { ICON_PATHS } from "@/components/ui/icons";

const FEATURES = [
  {
    title: "Nursing home records",
    text: "Each home's HIQA inspection reports, over time.",
    href: "/search",
    icon: ICON_PATHS.search,
  },
  {
    title: "Step-by-step guides",
    text: "How a family chooses a home, and what to ask when you visit.",
    href: "/resources",
    icon: ICON_PATHS.guides,
  },
  {
    title: "Fair Deal explained",
    text: "How the scheme works, who qualifies and how to apply.",
    href: "/guides/fair-deal",
    icon: ICON_PATHS.cost,
  },
  {
    title: "Who to contact",
    text: "Helplines, advocacy and the offices that handle Fair Deal.",
    href: "/contacts",
    icon: ICON_PATHS.phone,
  },
];

export function SiteFeatures() {
  return (
    <section aria-labelledby="help-h" className="flex flex-col gap-6">
      <h2 id="help-h" className="text-center font-heading text-2xl font-semibold tracking-tight md:text-3xl adult:text-left">
        What ClearCare can help you with
      </h2>
      {/* A line between neighbours, like a row of columns; on phones they stack without one. */}
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-line">
        {FEATURES.map((feature) => (
          <li key={feature.href} className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
            <Link
              href={feature.href}
              className="group flex h-full flex-col items-center gap-3 rounded-lg text-center text-ink no-underline hover:text-ink adult:items-start adult:text-left"
            >
              <IconCircle path={feature.icon} size="large" />
              <h3 className="font-heading text-xl font-semibold text-primary group-hover:underline">{feature.title}</h3>
              <p className="text-ink-muted">{feature.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
