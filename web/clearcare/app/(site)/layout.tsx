import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/site-footer";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import { SiteHeader } from "@/components/layout/site-header";

// Each page's one address for a search engine (CCARE-301): its own path on the live site, without
// the query string, so a guide opened from a home (?from=centre&centre=68) isn't held as a page of
// its own. "./" is the path of the page being rendered. Here and not in the root layout, where the
// page for an address that doesn't exist would get /_not-found as its own.
export const metadata: Metadata = { alternates: { canonical: "./" } };

// Every page in this group shares the site header and footer. The log in page sits outside it.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* A new page opens at its top, header and all. */}
      <ScrollToTop />
      <SiteHeader />
      <main className="page-column flex w-full flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-10">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
