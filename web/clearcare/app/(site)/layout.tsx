import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

// Pages behind the login screen share the site header and footer.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 md:gap-12 md:px-8 md:py-10">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
