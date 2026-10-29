import Link from "next/link";
import { NAV_ITEMS } from "@/components/layout/site-header";

// The header's pages, then the ones only the footer links to. Unfinished pages are left out.
const FOOTER_LINKS = [
  ...NAV_ITEMS.flatMap((item) => (item.href ? [{ label: item.label, href: item.href }] : [])),
  { label: "Privacy notice", href: "/privacy" },
];

// Three parts: what ClearCare is, the site's pages, and where the inspection information comes from.
// On the header's deep brand colour (brand-band, globals.css), so the two frame every page in the
// site's steady, official colour while the pages between them stay soft (CCARE-179).
// Where the floating menu button shows (phones and tablets, standard design), the last row keeps
// clear of the bottom-right corner it sits in, rather than the page leaving room for it below.
export function SiteFooter() {
  return (
    <footer className="brand-band brand-band-deep text-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between md:gap-12">
          <div className="flex max-w-sm flex-col gap-2">
            <Link href="/" className="w-fit font-heading text-xl font-semibold text-ink no-underline hover:text-ink tap-target">
              ClearCare
            </Link>
            <p className="text-ink-muted">
              HIQA nursing home inspection reports, made easier to search, understand and compare.
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-block py-1 tap-target">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="max-w-3xl border-t border-line pt-4 pr-20 text-xs text-ink-muted lg:pr-0 adult:pr-0">
          Contains information from inspection reports published by{" "}
          <a href="https://www.hiqa.ie">HIQA</a>. ClearCare is independent and isn&apos;t affiliated with or
          endorsed by HIQA. Check important details with the home and in the original report.
        </p>
      </div>
    </footer>
  );
}
