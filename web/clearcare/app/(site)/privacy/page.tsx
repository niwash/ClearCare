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
const SURVEY_RETENTION = "We keep the answers for the duration of the project and delete them when it ends.";
const LAST_UPDATED = "10 November 2026";

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
              Some choices you make are saved in your own browser: the colour theme, the easier-to-read design,
              whether you&apos;ve closed the welcome tour&apos;s box on this visit, your last search on this visit, so
              Compare Homes can take you back to it, and the homes on your Compare Homes shortlist. Clearing your browser&apos;s site data removes them. When you open Compare Homes, your shortlist&apos;s homes are in
              the page address, like any other page you visit, so they appear in the technical logs below.
            </li>
            {/* The place box (CCARE-228, components/search/place-box.tsx and google-places.tsx): Google's
                Places library loads only once something is typed in it, and is sent what is typed,
                then asked for the location of a picked town, area or Eircode, or of the first suggestion
                when Search is pressed with text that wasn't picked; a county isn't looked up. Measured on
                9 Nov 2026: it stores nothing in the site's cookies, localStorage or sessionStorage. */}
            <li>
              When you type in the &ldquo;Town, area or Eircode&rdquo; box on the search page, what you type goes to
              Google so it can suggest places. Like any request your browser makes, it carries your IP address.
              When you pick a town, an area or an Eircode, or search for what you typed, Google is also asked where
              that place is.
              Nothing goes to Google for this until you type in that box.{" "}
              <a href="https://policies.google.com/privacy">Google&apos;s privacy policy</a> covers what it does
              with these requests.
            </li>
            {/* "Use my location": the browser's Geolocation API, asked only on the click; nearFrom
                (lib/near.ts) rounds the point to two decimals before it goes into the search, and the
                API refuses anything finer (api/openapi.yaml, near). It isn't sent to Google, though the
                map of the results opens around it (the next item but one). */}
            <li>
              &ldquo;Use my location&rdquo; asks your browser where you are, only when you press it. The page rounds
              that to about 1 km before it goes anywhere, so our servers never get anything more precise. We
              don&apos;t store it, though like any page address it can appear in the technical logs below.
            </li>
            {/* place and near are in the page address (lib/page-search.ts), so they are in the history
                and in shared links, and in the last search (components/search/last-search.tsx), which
                keeps them on purpose. Only near is rounded (lib/near.ts); place is the box's text as typed
                or picked. Neither goes into a saved search (lib/preferences.ts). */}
            <li>
              The place you search from is in the page address, so it stays in your browser&apos;s history and in
              any link you share. It&apos;s also in your last search on this visit, which your browser keeps until
              you close the tab. Only the point we measure distances from is rounded to about 1 km: the name in the
              box stays as you typed or picked it, and a full Eircode there is an exact address.
            </li>
            {/* The search page's map (CCARE-229, components/search/results-map.tsx). Google's Maps
                JavaScript loads for it in two cases: when the search page opens with nothing searched,
                for the map of every home under the prompt, without anything being pressed; and once
                Map is chosen for a search's results (view=map in the page address). It asks Google for
                the map's pictures as it is moved. The homes' positions come from ClearCare's API
                through the site's server (ADR-0029) and are drawn in the browser. With a place or a
                location in the search, the map of the results opens around that point (firstView,
                lib/search-map.ts).

                Measured on 11 Nov 2026 in headless Chrome with an empty profile, on the search page
                with nothing searched: requests went to maps.googleapis.com,
                mapsresources-pa.googleapis.com, maps.gstatic.com, fonts.googleapis.com and
                fonts.gstatic.com, and Google's scripts set nothing in cookies, localStorage or
                sessionStorage. A list of results, opened on its own, sent no request to Google. */}
            <li>
              The search page shows a map of every nursing home before you search, and a map of your results
              when you choose &ldquo;Map&rdquo;. The map comes from Google, so opening the search page with
              nothing searched is enough for your browser to ask Google for it. Your browser asks Google for
              each part of the map you look at, and like any request this carries your IP address. If you
              searched from a place or from your location, the map of your results opens around it. The nursing
              homes&apos; positions come from ClearCare, not from you.{" "}
              <a href="https://policies.google.com/privacy">Google&apos;s privacy policy</a> covers what it does
              with these requests.
            </li>
            <li>
              Like any website, our servers keep short technical logs of requests. Finding faults and keeping the site
              secure is our legitimate interest in keeping them, and they&apos;re deleted after 14 days.
            </li>
          </ul>
        </PrivacySection>

        {/* The usability survey (CCARE-147), embedded from Microsoft Forms on /survey, which links
            here. ClearCare only links to and frames the form: answers go straight to Forms. */}
        <PrivacySection id="survey" title="If you answer the survey">
          <p>
            Our usability survey asks how easy ClearCare was to use. It runs on Microsoft Forms, so your answers go
            to Microsoft, which stores them for us, and not to ClearCare&apos;s own servers. The survey doesn&apos;t
            ask for your name or email address and doesn&apos;t record who you are, so please don&apos;t include
            them in your answers.
          </p>
          <p>
            We use the answers in our research, to find what&apos;s unclear or hard to use and improve ClearCare.
            Microsoft may set its own cookies when the form loads, which{" "}
            <a href="https://privacy.microsoft.com/privacystatement">Microsoft&apos;s privacy statement</a> covers.{" "}
            {SURVEY_RETENTION}
          </p>
        </PrivacySection>

        <PrivacySection id="accounts" title="If you create an account">
          {/* Accounts are live since CCARE-183 wired the production pool into the deployment. */}
          <p>You don&apos;t need an account to use ClearCare. If you create one, this is what we hold:</p>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {/* The pool signs in by email and asks for nothing else (infra/aws/modules/cognito/main.tf):
                no name is collected. If that changes, this changes in the same pull request. */}
            <li>
              Your email address, held by Amazon Cognito in the EU. We use it to sign you in and to contact you about
              your account. The legal basis is providing the service you asked for.
            </li>
            {/* Auth.js (PR #107) sets the session cookie, and short-lived state, PKCE and CSRF cookies
                while you sign in. */}
            <li>
              The cookies needed for signing in. One keeps you signed in: it&apos;s encrypted, page scripts can&apos;t
              read it, and it expires after 7 days without a visit. A few others last only while you sign in, to
              keep the sign-in itself secure. None of them needs your consent, because signing in can&apos;t work
              without them.
            </li>
            {/* The saved search (ADR-0025): clearcare.user_preferences, keyed on the account's id in
                clearcare.users, holding the county, the order and the ticked filter options only. */}
            <li>
              A search you ask us to remember: the county, the order and the care and amenity options you chose.
              It&apos;s kept with your account so it&apos;s there on your next visit, on any device, and what you
              type into the search boxes isn&apos;t kept. Saving one also keeps a number for your account, which
              the search is filed against. You can forget the search on the search page at any time; that leaves
              your account as it is, and if you ask us by email we remove the saved search along with the account.
            </li>
            {/* There's no delete route yet: an operator follows documentations/operations/account_deletion.md.
                The database's automatic backups are kept for 7 days (infra/aws/live/rds.tf). */}
            <li>
              We keep your account until you ask us by email to delete it. Once we have, copies left in our database
              backups are gone within 7 days.
            </li>
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
          {/* Amenities: Research/Data Extraction/extractor.py, Anthropic (Claude Haiku 5.5) by default since
              CCARE-198 (#135), OpenAI (GPT-4o-mini) with --provider openai; the rows loaded before it were
              read by GPT-4o-mini. Research: the outcome pilot, pipeline/src/clearcare_pipeline/outcome_pilot.py
              (Anthropic), run by hand and not served by the API. Everything else the site shows from reports
              is worked out by rules (ADR-0015, -0017). */}
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>To show each home&apos;s inspection history and what its reports say.</li>
            {/* The amenities-v2 extractor (CCARE-195): items from a fixed list of 93, each kept only with
                a quote from the report and its pages, and no free-text notes; since CCARE-199 (#137) a quote
                not found in the report's text is dropped before storing. The centre page and Compare Homes
                show them with the quotes (CCARE-163). The search filters and the ticks on search results
                use the same items (centre_amenities_v2), once GET /centres filters by them. The checking is
                the gold set and evaluation, CCARE-192 and -193: change "We're now checking" here and in
                centre-amenities.tsx when it's done. */}
            <li>
              To show what each home offers, such as its types of care, rooms, activities and facilities, and to let
              you search for homes by them. An AI service reads each report, picks these out from a fixed list and
              keeps the passage of the report each one comes from. Each home&apos;s page shows them with those
              passages, and Compare Homes shows them side by side, both saying they were read by an AI tool.
              We&apos;re now checking these results against the reports, so until that&apos;s done some may be wrong
              or missing.
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
              code on 9 Nov 2026, after CCARE-228: AWS in eu-north-1 (infra/aws), Vercel for previews
              of the site, Anthropic (Research/Data Extraction/extractor.py by default, and
              pipeline/src/clearcare_pipeline/outcome_pilot.py) and OpenAI (extractor.py with --provider
              openai, and the amenities loaded before CCARE-198), the last three in the US, and Google (the
              place box's suggestions, components/search/google-places.tsx, and since CCARE-229 the search
              page's map, components/search/results-map.tsx), which may handle these requests
              outside the EU. The pipeline's geocoding (ADR-0027) sends Google only the centres' register
              addresses, which name no visitor. Cloudflare only holds DNS records, so it sees no visits.
              Update this when a service changes. */}
          <PrivacySubheading>Who handles it</PrivacySubheading>
          <p>
            Service providers handle data for us: hosting providers run the site and store its data in the EU, AI
            services read the reports, and a maps service suggests places as you type in the search and draws the
            map on the search page. Some of these
            providers are in the United States, where data is protected
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
            {/* A change to the data ClearCare handles updates this page in the same pull request. */}
            We&apos;ll update this page whenever ClearCare changes how it uses data. Last updated {LAST_UPDATED}.
          </p>
        </PrivacySection>
      </div>
    </>
  );
}

// The top of the page, on the soft welcome band like the resources and contacts pages.
function PrivacyHero() {
  return (
    <section aria-labelledby="privacy-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
      <div className="page-column flex flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
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
