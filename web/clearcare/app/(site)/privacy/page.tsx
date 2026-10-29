import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fullWidthClass } from "@/components/ui/classes";

export const metadata: Metadata = {
  title: "Privacy notice · ClearCare",
  description: "What personal data ClearCare handles, why, who processes it and your rights.",
};

const RUN_BY = "master's students at Technological University Dublin";
// GDPR Arts. 13(1)(a) and 14(1)(a) ask for a way to contact us, and every right below is exercised
// by email.
const CONTACT_EMAIL = "hello@clearcare.ie";
// The outcome pilot's raw/ answers.
const RESEARCH_RETENTION =
  "Research copies of the AI service's answers are kept for the duration of the project and deleted when it ends.";
const LAST_UPDATED = "29 October 2026";

export default function PrivacyPage() {
  return (
    <>
      <PrivacyHero />

      <div className="flex max-w-3xl flex-col gap-8 leading-relaxed">
        <PrivacySection id="who" title="Who we are">
          {/* Said plainly because the legal basis for the reports leans on it. If ClearCare ever
              charges or turns commercial, this and that paragraph have to change. */}
          <p>
            ClearCare is a research project run by {RUN_BY}. The research is building a free website that gives the
            public clear information to help them choose a nursing home. ClearCare is not run for profit.
          </p>
          <p>
            We&apos;re responsible for the personal data described here. For any question about this notice or your
            data, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </PrivacySection>

        <PrivacySection id="browsing" title="Using ClearCare without an account">
          <p>
            You can search for homes, read their reports and use the guides without telling us who you are. We
            don&apos;t use advertising or analytics cookies, and we don&apos;t track you across other websites.
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              Some choices you make are saved in your own browser, such as the colour theme, the easier-to-read
              design and whether you&apos;ve seen the welcome tour. They never leave your device, and clearing your
              browser&apos;s site data removes them.
            </li>
            <li>
              Like any website, our servers keep short technical logs of requests. Finding faults and keeping the site
              secure is our legitimate interest in keeping them, and they&apos;re deleted after 14 days.
            </li>
          </ul>
        </PrivacySection>

        <PrivacySection id="accounts" title="If you create an account">
          <p>
            Accounts aren&apos;t open yet. When they are, this is what we&apos;ll hold:
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              Your email address, and your name if you give it, held by Amazon Cognito in the EU. We use them to sign
              you in and to contact you about your account. The legal basis is providing the service you asked for.
            </li>
            {/* Auth.js (PR #107) sets the session cookie, and short-lived state, PKCE and CSRF cookies
                while you sign in. */}
            <li>
              The cookies needed for signing in. One keeps you signed in: it&apos;s encrypted, page scripts can&apos;t
              read it, and it expires after 7 days without a visit. A few others last only while you sign in, to
              keep the sign-in itself secure. None of them needs your consent, because signing in can&apos;t work
              without them.
            </li>
            <li>We keep your account until you delete it, or ask us to by email.</li>
          </ul>
        </PrivacySection>

        {/* What GDPR Art. 14 asks for when data comes from somewhere other than the person: the source,
            the categories of data, every purpose with its legal basis, the right to object set apart
            (Art. 21(4)), retention, recipients and transfers. */}
        <PrivacySection id="reports" title="HIQA inspection reports">
          <p>
            ClearCare is built from the inspection reports HIQA publishes on its website, which anyone can read. We
            store each report and show what it says, so families can find and compare nursing homes.
          </p>

          <PrivacySubheading>What the reports contain about people</PrivacySubheading>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              The names and roles of people who run each home, such as the person in charge and the registered
              provider, as HIQA prints them.
            </li>
            {/* GET /reports/{report_id} returns them (api/openapi.yaml, "inspectors"). */}
            <li>The names and roles of the HIQA inspectors who carried out each inspection.</li>
            <li>
              Descriptions of residents&apos; care, which HIQA writes without naming anyone. We don&apos;t try to
              work out who any resident is, and we don&apos;t add anything about residents to what HIQA has
              published.
            </li>
          </ul>

          <PrivacySubheading>How we use them</PrivacySubheading>
          {/* Amenities: Research/Data Extraction/extractor.py (OpenAI). Research: the outcome pilot,
              pipeline/src/clearcare_pipeline/outcome_pilot.py (Anthropic), run by hand and not served by
              the API. Everything else the site shows from reports is worked out by rules (ADR-0015, -0017). */}
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>To show each home&apos;s inspection history and what its reports say.</li>
            {/* What the extractor does today: free-text dining_notes and other_notes, which aren't quotes,
                and a prompt that accepts what is "clearly implied" (extractor.py:120, 127, 193). Once it
                only keeps values it can quote from the report, this can say it extracts and doesn't write.
                Nothing it finds is shown on the site yet: the care types and amenities filters, the centre
                page and Compare Homes all say "Coming soon". Change this when they show it. */}
            <li>
              To find details such as care types and amenities. An AI service reads each report and records what it
              finds, including short notes that summarise what the report says. This tool is still being developed:
              its results haven&apos;t yet been checked against the reports, and none of them are shown on ClearCare
              yet. We&apos;ll update this notice before they are.
            </li>
            <li>
              For research on how findings change from one inspection to the next. An AI service reads the reports
              for this too. The research results aren&apos;t shown on ClearCare.
            </li>
          </ul>
          <p>
            The legal basis is legitimate interests: ours and the public&apos;s, in making published inspection
            findings easier to find and compare, on a free website that isn&apos;t run for profit. The people named
            in the reports are named in their professional roles, in reports HIQA has already published, so we
            believe this use doesn&apos;t override their interests.
          </p>

          <PrivacySubheading>Objecting</PrivacySubheading>
          <p>
            If you&apos;re named in a report, you can object to how we use your data by emailing us. HIQA is
            responsible for the reports and what they say: to have a report itself corrected, contact HIQA.
          </p>

          <PrivacySubheading>How long we keep it</PrivacySubheading>
          <p>
            We keep a report, and the details found in it, for as long as ClearCare shows that home&apos;s history.{" "}
            {RESEARCH_RETENTION}
          </p>

          {/* GDPR Arts. 13 and 14 need the recipients, by category at least, and any transfer outside
              the EU with its safeguards. Categories, by the team's choice (PR #112). Checked against the
              code on 29 Oct 2026: AWS in eu-north-1 (infra/aws), Vercel for previews of the site, OpenAI
              (Research/Data Extraction/extractor.py) and Anthropic
              (pipeline/src/clearcare_pipeline/outcome_pilot.py), the last three in the US. Cloudflare
              only holds DNS records, so it sees no visits. Update this when a service changes. */}
          <PrivacySubheading>Who handles it</PrivacySubheading>
          <p>
            Service providers handle data for us: hosting providers run the site and store its data in the EU, and
            AI services read the reports. Some of these providers are in the United States, where data is protected
            by the safeguards EU law requires, such as the EU&ndash;US Data Privacy Framework or the European
            Commission&apos;s standard contractual clauses. Email us for a copy of these safeguards.
          </p>
        </PrivacySection>

        <PrivacySection id="rights" title="Your rights">
          <p>
            You can ask to see the personal data we hold about you, to correct it, to delete it, to limit how we use
            it, to get a copy to take elsewhere, or to object to how we use it. Email us and we&apos;ll reply within
            a month.
          </p>
          <p>
            If you&apos;re unhappy with how we&apos;ve handled your data, you can complain to the{" "}
            <a href="https://www.dataprotection.ie">Data Protection Commission</a>.
          </p>
        </PrivacySection>

        <PrivacySection id="changes" title="Changes to this notice">
          <p>
            We&apos;ll update this page when ClearCare changes how it uses data, such as when accounts open.
            Last updated {LAST_UPDATED}.
          </p>
        </PrivacySection>
      </div>
    </>
  );
}

// The top of the page, on a band of brand colour like the resources and contacts pages.
function PrivacyHero() {
  return (
    <section aria-labelledby="privacy-h" className={`${fullWidthClass} brand-band -mt-6 md:-mt-10`}>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb trail={[]} current="Privacy notice" />
        <h1 id="privacy-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Privacy notice
        </h1>
        <p className="max-w-2xl text-ink-muted md:text-lg">
          What personal data ClearCare handles, why, and what you can ask us to do with it.
        </p>
      </div>
    </section>
  );
}

function PrivacySubheading({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 font-heading text-lg font-semibold">{children}</h3>;
}

function PrivacySection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-3">
      <h2 id={`${id}-h`} className="font-heading text-xl font-semibold md:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}
