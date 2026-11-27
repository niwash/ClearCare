// The daily register and report checks and weekly price checks follow the pipeline schedule in
// pipeline/src/clearcare_pipeline/schedule/__main__.py. Update this copy when the schedule changes.
// The footer and start page link here to keep the main menu focused on using the site (CCARE-309).
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Section } from "@/components/layout/section";
import { fullWidthClass } from "@/components/ui/classes";
import { CONTACT_EMAIL } from "@/lib/contact";
import { RUN_BY } from "@/lib/site-identity";

const TITLE = "About ClearCare";
const DESCRIPTION = "Who runs ClearCare, where our nursing home information comes from and how to report a mistake.";

export const metadata: Metadata = { title: TITLE, description: DESCRIPTION };

export default function AboutPage() {
  return (
    <>
      <section aria-labelledby="about-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
        <div className="page-column flex flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
          <Breadcrumb trail={[]} current={TITLE} />
          <h1 id="about-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {TITLE}
          </h1>
          <p className="max-w-2xl text-ink-muted md:text-lg">{DESCRIPTION}</p>
        </div>
      </section>

      <div className="flex max-w-3xl flex-col gap-8 leading-relaxed">
        <Section title="What ClearCare is">
          <p>
            ClearCare is free and independent. It helps you read what HIQA has found and understand your options
            when choosing a nursing home. ClearCare doesn&apos;t rate or recommend homes. It isn&apos;t affiliated
            with or endorsed by HIQA.
          </p>
        </Section>

        <Section title="Who runs it">
          <p>ClearCare is a research project run by {RUN_BY}. ClearCare is not run for profit.</p>
        </Section>

        <Section title="Where the information comes from">
          <p>
            Every day we check{" "}
            <a href="https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv">HIQA&apos;s register of nursing homes (CSV)</a>
            {" "}and look for new{" "}
            <a href="https://www.hiqa.ie/find-a-centre">inspection reports on HIQA&apos;s centre pages</a>.
            Once a week we check the{" "}
            <a href="https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/about/">HSE&apos;s Fair Deal price lists</a>.
          </p>
          {/* The credit the boundaries' licence asks for (CCARE-319, public/county-boundaries/README.md). */}
          <p>
            The county boundaries on the map are from{" "}
            <a href="https://data-osi.opendata.arcgis.com/datasets/osi::counties-national-statutory-boundaries-2019-generalised-20m">Tailte Éireann&apos;s National Statutory Boundaries</a>
            , simplified for the map. © Tailte Éireann, used under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
          </p>
          {/* The credit the landmarks' two sources ask for (CCARE-322, lib/landmarks.ts). Each row of
              Research/City Landmarks cites the one its coordinates are from. */}
          <p>
            For 115 cities and towns, a search from the town measures distances from a landmark in it. The
            landmarks&apos; coordinates are from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, © OpenStreetMap
            contributors, used under the Open Database Licence, and from the{" "}
            <a href="https://data.gov.ie/dataset/national-inventory-of-architectural-heritage-niah-national-dataset">National Inventory of Architectural Heritage</a>
            , © Government of Ireland, used under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
          </p>
          {/* The credit the towns' boundaries ask for, in the layer's own words (CCARE-323,
              public/town-boundaries/README.md). */}
          <p>
            The towns&apos; boundaries on the map are the{" "}
            <a href="https://censushub-ie-cso.hub.arcgis.com/datasets/IE-CSO::census-2022-table-1-2-population-by-sex-and-marital-status-by-built-up-urban-areas">Census 2022 Built Up Areas</a>
            , simplified for the map. © CSO/Tailte Éireann, used under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
          </p>
        </Section>

        <Section title="How it is prepared, and its limits">
          <p>
            We automatically read the reports for inspection dates, HIQA&apos;s judgements on regulations,
            inspectors&apos; comments and providers&apos; responses. An AI model reads the report text for types of
            care, rooms, activities and facilities.
          </p>
          <p>Some details may be wrong or missing. Check important details with the home and in the original report.</p>
        </Section>

        <Section title="Contact us">
          <p>
            Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with questions about ClearCare. You can
            also use this address to report a mistake.
          </p>
        </Section>
      </div>
    </>
  );
}
