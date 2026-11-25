import type { Metadata } from "next";
import { GlossaryList } from "@/components/glossary/glossary-list";
import { Breadcrumb, RESOURCES_CRUMB } from "@/components/layout/breadcrumb";
import { ContactsBanner } from "@/components/layout/contacts-banner";
import { fullWidthClass } from "@/components/ui/classes";
import { References } from "@/components/ui/references";
import { GLOSSARY } from "@/lib/glossary";
import { pageReferences, type SourceKey } from "@/lib/references";
import { REGULATIONS_SOURCE } from "@/lib/regulations";

export const metadata: Metadata = {
  title: "Glossary · ClearCare",
  description: "What the words on ClearCare and in HIQA inspection reports mean, from substantially compliant to Fair Deal.",
};

// A page of the words families stopped at in user testing, in plain words (CCARE-283): A to Z, with a
// category to narrow it to (components/glossary/glossary-list.tsx). The terms and why each is here
// are in lib/glossary.ts. Each term has its own anchor, so a page can link to one:
// /resources/glossary#substantially-compliant.
//
// The sources its meanings follow, in a folded References at its foot (CCARE-299): each term names
// its own (lib/glossary.ts), so the list is made from them and can't leave one out, with HIQA's
// framework, which every judgement's quoted definition comes from.
const SOURCES = [...new Set<SourceKey>(["hiqaFramework", ...GLOSSARY.flatMap((group) => group.terms.flatMap((term) => term.sources ?? []))])];
const REFS = pageReferences(SOURCES);
const CITATIONS = Object.fromEntries(SOURCES.map((key) => [key, { id: REFS[key].id, cite: REFS[key].cite }]));

export default function GlossaryPage() {
  return (
    <>
      <GlossaryHero />

      {/* HIQA's framework is linked by its address alone, so its regulation quotes stay on the server. */}
      <GlossaryList groups={GLOSSARY} hiqaSourceUrl={REGULATIONS_SOURCE.url} citations={CITATIONS} />

      <References
        references={REFS.list}
        note={
          <>
            HIQA&apos;s definitions are quoted as HIQA published them; the plain words are ClearCare&apos;s. Fair Deal
            Explained cites the paying terms in more detail. These organisations do not endorse ClearCare.
          </>
        }
      />

      <ContactsBanner className="-mb-6 md:-mb-10" />
    </>
  );
}

function GlossaryHero() {
  return (
    <section aria-labelledby="glossary-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
      <div className="page-column flex flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb trail={[RESOURCES_CRUMB]} current="Glossary" />
        <h1 id="glossary-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Glossary
        </h1>
        <p className="max-w-3xl text-ink-muted md:text-lg">
          What the words on ClearCare, and in HIQA&apos;s and the HSE&apos;s own pages, mean in plain words.
        </p>
      </div>
    </section>
  );
}
