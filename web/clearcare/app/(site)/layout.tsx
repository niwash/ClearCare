import { SiteFooter } from "@/components/layout/site-footer";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import { SiteHeader } from "@/components/layout/site-header";

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
