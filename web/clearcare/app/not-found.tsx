import { NotFoundContent } from "@/components/layout/not-found-content";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// The 404 page for an address that matches no page (CCARE-214). It replaces everything under the
// root layout, outside the (site) group, so it brings the site's header, <main> and footer itself,
// as the (site) layout does. notFound() inside the group shows app/(site)/not-found.tsx instead,
// which leaves them to the group's layout.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="page-column flex w-full flex-1 flex-col gap-6 px-4 py-6 md:gap-8 md:px-8 md:py-10">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </>
  );
}
