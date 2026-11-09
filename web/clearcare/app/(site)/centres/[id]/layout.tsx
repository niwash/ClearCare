// app/centres/[id]/layout.tsx
// What every page of a home's record shares (CCARE-212): the home's name, the tabs for the overview
// and its subpages, and the guides and contacts at the end. The record was one long page; its long
// sections are now pages of their own, so a family scrolls less and can link to the part they mean.
import { CentreTabs, type CentreTab } from "@/components/centre/centre-tabs";
import { GuidesBand } from "@/components/guides/guide-ending";
import { Alert } from "@/components/layout/alert";
import { Breadcrumb, SEARCH_CRUMB } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { fullWidthClass } from "@/components/ui/classes";
import { type CentreDetail } from "@/lib/centres";
import { CENTRE_SECTION_TITLES, centrePath, getCentreRecord } from "@/lib/centre-record";
import { getGuide } from "@/lib/guides";
import { unavailableMessage } from "@/lib/search";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// The guides that help most with a record, in the order a family needs them.
const RECORD_GUIDES = [getGuide("reading-inspection-reports"), getGuide("choosing-a-nursing-home"), getGuide("fair-deal")];

export default async function CentreLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getCentreRecord(id);
  // notFound() here shows app/(site)/not-found.tsx inside the site's layout.
  if (record.status === "not-found") notFound();
  if (record.status === "unavailable") return <CentreUnavailable httpStatus={record.httpStatus} />;
  const { centre } = record;

  // All four tabs on every home, so a family finds the same ones each time; a page with nothing on
  // it says why (NothingToFlag, and the inspections page's own message when there are no reports).
  // Each tab is coloured like the band its page starts with, so the current one runs into it.
  // What happened next follows What to look at first, as it follows up the same regulations; the
  // full inspection history after them, and What to ask last, as what the family can do with it all.
  const tabs: CentreTab[] = [
    { href: centrePath(id), label: "Overview", band: "bg-page" },
    { href: centrePath(id, "look-first"), label: CENTRE_SECTION_TITLES["look-first"], band: "bg-tint-gold" },
    { href: centrePath(id, "next-steps"), label: CENTRE_SECTION_TITLES["next-steps"], band: "bg-tint-sage" },
    { href: centrePath(id, "inspections"), label: CENTRE_SECTION_TITLES.inspections, band: "bg-band" },
    { href: centrePath(id, "questions"), label: CENTRE_SECTION_TITLES.questions, band: "bg-tint-blue" },
  ];

  return (
    <>
      <CentreHero centre={centre} tabs={tabs} />

      {/* Each section on its own band of colour, edge to edge, touching the next and the name's band. */}
      <div className="-mt-6 flex flex-col md:-mt-8">{children}</div>

      {/* So nobody leaves a record unsure what it means or what to do next. The negative top margin
          cancels the page's gap, so it meets the last section's band with no strip of page colour
          between; the bottom one is the band's own default. */}
      <GuidesBand
        id="help-h"
        title="Making sense of this record"
        intro="Inspection reports use a lot of HIQA’s own language. Our guides explain it, and what to ask next."
        guides={RECORD_GUIDES}
        className="-mt-6 -mb-6 md:-mt-8 md:-mb-8"
      />

      {/* The negative bottom margin cancels the page's padding, so it meets the footer. */}
      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}

// The top of every page of the record, flush under the header as on the resources page: the
// breadcrumb, the home's name and the tabs on the soft welcome band (welcome-band, globals.css).
// It stays still between tabs, since the layout is kept while they change.
function CentreHero({ centre, tabs }: { centre: CentreDetail; tabs: CentreTab[] }) {
  return (
    <section aria-labelledby="centre-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
      <div className="page-column flex flex-col gap-5 px-4 pt-6 md:px-8 md:pt-8">
        <div className="flex min-w-0 flex-col gap-2.5">
          {/* Where the home sits in the site, the same however the user got here. */}
          <Breadcrumb
            trail={[
              SEARCH_CRUMB,
              { label: `Co. ${centre.county}`, href: `/search?${new URLSearchParams({ county: centre.county })}` },
            ]}
            current={centre.centre_name}
          />
          <h1 id="centre-h" className="font-heading text-[2rem] leading-tight font-semibold tracking-tight text-ink md:text-[2.5rem]">
            {centre.centre_name}
          </h1>
        </div>
        <CentreTabs tabs={tabs} />
      </div>
    </section>
  );
}

// The same message the search page shows when the data can't be read.
function CentreUnavailable({ httpStatus }: { httpStatus: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-ink-muted">
        <Link href="/" className="inline-block py-1 tap-target">
          Home
        </Link>
      </div>
      <Alert title="This record isn't available right now">{unavailableMessage(httpStatus)}</Alert>
    </div>
  );
}
