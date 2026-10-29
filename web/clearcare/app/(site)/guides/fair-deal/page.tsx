import type { ReactNode } from "react";
import { GuideEnding } from "@/components/guides/guide-ending";
import { guideMetadata } from "@/components/guides/guide-header";
import { GuideHero } from "@/components/guides/guide-hero";
import { SectionAccordion } from "@/components/guides/section-accordion";
import { sectionScrollMargin, StepNumber } from "@/components/guides/step-number";
import { getGuide } from "@/lib/guides";
import { fullWidthClass } from "@/components/ui/classes";
import { OrganisationIcon, type OrganisationKind } from "@/components/ui/organisation-icon";
import { Icon } from "@/components/ui/icons";
import { ShowHide } from "@/components/ui/chevron";

const guide = getGuide("fair-deal");

export const metadata = guideMetadata(guide);

// Text from Research/fair-deal-guide.md (CCARE-86, PR #47), checked against the HSE's pages and
// the current application form, with the same corrections made in both (CCARE-129).

const HSE_FORM =
  "https://assets.hse.ie/media/documents/The_Nursing_Home_Support_Scheme_Application_Form_and_Support_Information_iufvU3b.pdf";
const CAG_REPORT =
  "https://www.audit.gov.ie/media/u4kaxxwq/special-report-110-the-nursing-homes-support-scheme-fair-deal-_.pdf";
const HSE_FINANCIAL = "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/financial-assessment/";
const HSE_APPROVED_HOMES = "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/finding-the-right-nursing-home/";
const HSE_OFFICES = "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/contact/";

// Each section's description is what its header says while closed, so the guide can be scanned
// without opening anything. Keep it to what the section itself says.
const SECTIONS = [
  {
    id: "what-is-fair-deal",
    title: "What is Fair Deal?",
    description: "The scheme in brief: you pay what you can afford, and the HSE pays the rest.",
  },
  {
    id: "who-can-apply",
    title: "Who Can Apply?",
    description: "Anyone who ordinarily lives in Ireland and needs full-time nursing home care.",
  },
  {
    id: "what-does-fair-deal-cover",
    title: "What Does Fair Deal Cover?",
    description: "What the scheme pays for, and the extras you pay for yourself.",
  },
  {
    id: "how-much-will-you-pay",
    title: "How Much Will You Pay?",
    description: "How the financial assessment works out your contribution, with worked examples.",
  },
  {
    id: "three-year-cap",
    title: "The 3-Year Cap: Protecting Your Family Home",
    description: "How your home is counted, and why that stops after three years in care.",
  },
  {
    id: "nursing-home-loan",
    title: "The Nursing Home Loan",
    description: "An optional loan for the part of your contribution linked to your home.",
  },
  {
    id: "how-to-apply",
    title: "How to Apply: Step by Step",
    description: "From getting the form to approval. Funding starts from approval, so apply early.",
  },
  {
    id: "contacts",
    title: "Useful Contacts and Where to Get Help",
    description: "Who can answer your questions and help with the forms.",
  },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const COVERED = ["Your room and bed", "All your meals", "Laundry", "The nursing and personal care you need"];

const CONTACTS: { who: string; kind: OrganisationKind; what: string; link?: { href: string; label: string }; phone?: string; note?: string }[] = [
  {
    who: "HSE Nursing Homes Support Scheme",
    kind: "public-body",
    what: "Applications, financial assessments, the nursing home loan",
    link: { href: "https://www.hse.ie/nhss/", label: "hse.ie/nhss" },
  },
  {
    who: "Your local Nursing Homes Support Office",
    kind: "public-body",
    what: "Starting your application, collecting forms",
    link: { href: HSE_OFFICES, label: "Find your local office on hse.ie" },
  },
  {
    who: "HSE Live",
    kind: "public-body",
    what: "Help with the application form and general Fair Deal questions",
    phone: "1800 700 700",
    note: "Free. Monday to Friday 8am to 8pm, Saturday 9am to 5pm",
  },
  {
    who: "Citizens Information",
    kind: "public-body",
    what: "Free, independent advice on Fair Deal",
    link: { href: "https://www.citizensinformation.ie", label: "citizensinformation.ie" },
    phone: "0818 07 4000",
  },
  {
    who: "ALONE",
    kind: "charity",
    what: "Free support and advocacy for older people",
    link: { href: "https://alone.ie", label: "alone.ie" },
    phone: "0818 222 024",
  },
  {
    who: "Age Action Ireland",
    kind: "charity",
    what: "Information and support for older people",
    link: { href: "https://www.ageaction.ie", label: "ageaction.ie" },
  },
  {
    who: "A solicitor",
    kind: "legal",
    what: "Advice on the nursing home loan, Power of Attorney, and estate planning",
    link: { href: "https://www.lawsociety.ie", label: "lawsociety.ie" },
  },
];

export default function FairDealGuide() {
  return (
    <>
      <GuideHero guide={guide} />

      {/* The whole scheme in a sentence, before the detail. */}
      <p className="max-w-4xl rounded-lg border border-line border-l-4 border-l-primary bg-surface px-5 py-4 md:text-lg">
        <strong>Fair Deal</strong> is the Irish government&apos;s scheme to help pay for long-term nursing home care.{" "}
        <strong>You pay what you can afford. The State (HSE) pays the rest.</strong>
      </p>

      {/* The eight sections as an accordion, closed to begin with and one open at a time: their
          headers are the contents, so the whole guide fits on a screen and each part is one tap
          away (CCARE-146). */}
      <div className="flex max-w-4xl flex-col gap-3">
        <SectionAccordion />

        <GuideSection id="what-is-fair-deal">
          <p>
            Fair Deal is the Irish government&apos;s scheme to help pay for long-term nursing home care. Its official name
            is the Nursing Homes Support Scheme (NHSS), and it has been running since 2009.
          </p>
          <p>
            <strong>You pay what you can reasonably afford, and the State (HSE) pays the rest.</strong> Your contribution
            is worked out by looking at your income and your savings or property. If the nursing home costs more than your
            contribution, the HSE makes up the difference.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Figure value="23,500" label="people supported by Fair Deal (November 2024)" />
            <p>
              Fair Deal supports about 23,500 people, according to the Minister of State at the Department of Health in
              November 2024 (
              <Source href="https://www.oireachtas.ie/en/debates/question/2024-11-05/1069/">
                Dáil Éireann, written answer, 5 November 2024
              </Source>
              ). It works for care in any nursing home approved for Fair Deal: public, voluntary (charitable), or a
              private home on the HSE&apos;s approved list (
              <Source href={HSE_APPROVED_HOMES}>HSE, Finding the right nursing home</Source>).
            </p>
          </div>
        </GuideSection>

        <GuideSection id="who-can-apply">
          <p>
            Anyone who lives in Ireland and needs long-term nursing home care can apply. There is no minimum age, though
            the scheme is most commonly used by older adults.
          </p>
          <p>You must meet two conditions:</p>
          <ol className="grid gap-3 md:grid-cols-2">
            <NumberedCard number={1}>
              <strong>You must ordinarily live in Ireland.</strong> This means you have been living in Ireland for at least
              one year, or you intend to live here for at least one year (
              <Source href="https://www.citizensinformation.ie/en/health/health-system/entitlement-to-public-health-services/">
                Citizens Information
              </Source>
              ).
            </NumberedCard>
            <NumberedCard number={2}>
              <strong>You must genuinely need full-time nursing home care.</strong> This is checked through a care needs
              assessment (explained in the application steps below).
            </NumberedCard>
          </ol>
          <p>
            There is no income or savings threshold that stops you from applying. Whether you are well-off or have very
            little, you can use Fair Deal. The difference is how much you are asked to contribute.
          </p>
        </GuideSection>

        <GuideSection id="what-does-fair-deal-cover">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
              <h3 className="flex items-center gap-2 font-semibold md:text-lg">
                <Mark kind="yes" /> Covered
              </h3>
              <p>Fair Deal covers the main costs of being in a nursing home approved for Fair Deal:</p>
              <ul className="flex flex-col gap-2">
                {COVERED.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Mark kind="yes" small />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
              <h3 className="flex items-center gap-2 font-semibold md:text-lg">
                <Mark kind="no" /> What Fair Deal does NOT cover
              </h3>
              <p>
                Fair Deal does <strong>not</strong> pay for extras beyond standard care. You (or your family) will need to
                pay separately for things like:
              </p>
              <ul className="flex flex-col gap-2">
                <NotCovered>Hairdressing</NotCovered>
                <NotCovered>
                  Therapies such as physiotherapy or occupational therapy, unless included in your care plan (
                  <Source href={CAG_REPORT}>Comptroller and Auditor General, Special Report 110</Source>)
                </NotCovered>
                <NotCovered>Social activities or outings charged by the home</NotCovered>
                <NotCovered>Personal items such as clothing, toiletries, or newspapers</NotCovered>
                <NotCovered>Short-term care like respite stays or day care</NotCovered>
              </ul>
            </div>
          </div>
          <p>
            Always ask the nursing home to give you a written list of what extra charges may apply. These will be set out
            in your contract with them (
            <Source href="https://nhi.ie/wp-content/uploads/2022/03/Guide-to-Nursing-Home-Charges-for-Fair-Deal-NHSS-Residents-21.11.19.pdf">
              NHI, Guide to Nursing Home Charges for Fair Deal/NHSS Residents
            </Source>
            ).
          </p>
        </GuideSection>

        <GuideSection id="how-much-will-you-pay">
          <p>
            The HSE works out how much you pay through a <strong>financial assessment</strong> of your{" "}
            <strong>assessable income</strong> (
            <Source href={`${HSE_FORM}#page=24`}>HSE, NHSS Application Form and Support Information, p.24</Source>) and
            what you own.
          </p>

          <h3 className="font-heading text-lg font-semibold md:text-xl">Your income</h3>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            {/* No minimum width: on a phone the two columns wrap, rather than the table widening the page. */}
            <table className="w-full text-left">
              <thead className="bg-surface-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Situation</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Rate assessed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                <tr>
                  <td className="px-4 py-3 align-top">Single person</td>
                  <td className="px-4 py-3 align-top font-semibold">80% of weekly income</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 align-top">Couple (combined income)</td>
                  <td className="px-4 py-3 align-top">
                    <strong>40% of the couple&apos;s combined weekly income</strong>, which is 80% of the half that is
                    counted as yours
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 align-top">
                    Rental income from your family home (if rented while you are in care)
                  </td>
                  <td className="px-4 py-3 align-top">
                    You can apply to have it made exempt entirely (
                    <Source href={`${HSE_FINANCIAL}#:~:text=you%20can%20apply%20to%20have%20all%20your%20rental%20income%20made%20exempt`}>
                      HSE, Financial assessment
                    </Source>
                    ). If you don&apos;t, it is counted with your other income: 80% for a single person, 40% for a couple.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-ink-muted italic">
            For example: if you receive the State Pension (Contributory) of €299.30 per week (
            <Source href="https://www.gov.ie/en/department-of-social-protection/publications/budget-2026/">Budget 2026</Source>
            ), 80% of that is about €239. That amount goes toward your nursing home cost.
          </p>

          <h3 className="font-heading text-lg font-semibold md:text-xl">Your savings and assets</h3>
          <p>
            There is a <strong>disregard</strong>, a buffer amount that is not counted. Currently, the first €36,000 of
            assets for a single person (€72,000 for a couple) is not assessed at all.
          </p>
          <p>
            On top of that, 7.5% of the value of what you own above the disregard is counted each year (3.75% if you are
            part of a couple).
          </p>
          <p>
            Assets include cash savings, investments, and non-cash assets such as property, land, and business interests,
            whether held in Ireland or abroad (
            <Source href={`${HSE_FORM}#page=21`}>HSE, NHSS Application Form and Support Information, p.21</Source>). You
            also need to declare any gifts made in the last 5 years (p.7, p.8, p.22) and any outstanding loans or
            borrowings (p.7, p.8) on the same form.
          </p>

          <Callout title="Your contribution is the same at every nursing home">
            Once the HSE calculates your weekly contribution,{" "}
            <strong>
              that amount stays the same at any nursing home approved for Fair Deal (public, voluntary, or a private home
              on the HSE&apos;s approved list).
            </strong>{" "}
            The HSE pays the difference between your contribution and what the nursing home charges (
            <Source href={HSE_APPROVED_HOMES}>HSE, Finding the right nursing home</Source>).
          </Callout>

          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-lg font-semibold md:text-xl">Worked examples</h3>
            <Example number={1} title="Single person" description="Mary: a State Pension, some savings and no home of her own">
              <p>
                Mary is a widow. Her State Pension is ~€300 per week and she has €20,000 in savings (below the €36,000
                disregard). Mary does not own a home. She lives in rented accommodation, so no property is included in her
                assessment.
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>
                  Income contribution: 80% x €300 = <strong>€240 per week</strong>
                </li>
                <li>Asset contribution: €0 (savings are below the disregard)</li>
              </ul>
              <Total>
                <strong>Mary pays €240 per week.</strong> If her nursing home costs €1,200 per week, the HSE pays the
                remaining €960.
              </Total>
            </Example>

            <Example number={2} title="Couple" description="Tom and Anne: two pensions, savings and a home Anne still lives in">
              <p>
                Tom and Anne are married and have a combined weekly income of ~€600 (two State Pensions). Tom moves into a
                nursing home. They have €50,000 in savings between them (below the €72,000 couple disregard), and they
                jointly own their family home, worth €300,000. Anne continues to live there.
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>
                  Income contribution: 40% x €600 = <strong>€240 per week</strong>
                </li>
                <li>
                  Asset contribution: the €72,000 couple disregard is taken off their combined savings and home together
                  (savings first, then the home): €50,000 + €300,000 − €72,000 = €278,000. At 3.75% a year, that&apos;s
                  €10,425 per year, about €200 per week, for up to 3 years (
                  <Source href={`${HSE_FORM}#page=22`}>HSE, NHSS Application Form and Support Information, p.22</Source>
                  ). The rate is 3.75% because they are a couple, not because Anne still lives there. This amount can be
                  deferred using the nursing home loan (see below) while Anne continues to live in the home, so Tom and
                  Anne don&apos;t have to pay it week to week.
                </li>
              </ul>
              <Total>
                <strong>
                  Tom&apos;s weekly contribution is €240, plus the €200 asset-related amount which can be deferred via the
                  nursing home loan.
                </strong>{" "}
                The HSE pays the rest of the nursing home cost above that.
              </Total>
              <p className="text-sm text-ink-muted">
                Note: 40% (not 80%) is used for the couple&apos;s combined income because the HSE assesses each
                person&apos;s share of the combined income at the single rate of 80%, which works out to 40% of the total
                (<Source href={`${HSE_FORM}#page=25`}>HSE, NHSS Application Form and Support Information, p.25</Source>).
                This also applies to couples who have been living together as partners for at least 3 years, not just
                married couples (same application form, p.25).
              </p>
            </Example>

            <Example number={3} title="Renting out the family home" description="Brigid: single, with a home she rents out while in care">
              <p>
                Brigid is single and owns her family home, worth €300,000. She moves into a nursing home and decides to
                rent it out for €800 per month (about €185 per week) rather than leave it empty. Her State Pension is
                €299.30 per week.
              </p>
              <p>
                Because Brigid is renting out her family home while in care, she can apply to have that rental income
                made exempt from the financial assessment entirely (
                <Source href={`${HSE_FINANCIAL}#rental-income-for-your-home`}>HSE, Financial assessment</Source>). If
                she doesn&apos;t apply for the exemption, the rental income is instead treated as general income:
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>Pension contribution: 80% x €299 = €239 per week</li>
                <li>
                  Rental income contribution (if not exempted): 80% x €185 = €148 per week, because Brigid is a single
                  person (a couple&apos;s income, including rental income, is assessed at 40% instead)
                </li>
                <li>
                  Home contribution: 7.5% x (€300,000 − €36,000 disregard) = €19,800 per year, about €381 per week, for up
                  to three years under the 3-year cap (explained below). This amount can be deferred using the nursing
                  home loan.
                </li>
              </ul>
              <Total>
                <strong>
                  Brigid&apos;s total weekly contribution, if she doesn&apos;t apply for the rental exemption: €239 pension
                  + €148 rent + €381 home-related = €768, of which the €381 can be deferred via the nursing home loan.
                </strong>{" "}
                If she applies for the rental exemption, that drops to €239 pension + €381 home-related, with the €381
                still deferrable.
              </Total>
            </Example>
          </div>
        </GuideSection>

        <GuideSection id="three-year-cap">
          <p>
            Many families worry that going into a nursing home means losing the family home. The 3-year cap is the rule
            that limits this.
          </p>

          <h3 className="font-heading text-lg font-semibold md:text-xl">How it works</h3>
          <p>
            If you own your home, its value is included in the financial assessment after the disregard is applied. The
            HSE counts <strong>7.5% of your home&apos;s value per year</strong> (above the €36,000 single-person
            disregard) as part of your contribution. For a home worth €300,000, if the home is your only asset, that&apos;s
            7.5% of €264,000 (€300,000 minus the €36,000 disregard) = €19,800 per year, or about €381 per week. The
            disregard comes off your total assets, cash savings first, so if you also have savings, less of the disregard
            is left to come off the home. If you are part of a couple, the rate is 3.75%: for the same home with no other
            assets, that works out to about €164 per week.
          </p>
          <p>
            However, <strong>after three years, the family home is no longer counted at all</strong>, even if you remain
            in the nursing home for many more years. This three-year limit is called the <strong>3-year cap</strong>.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Figure value="22.5%" label="most of the home's value counted for a single person (3 x 7.5%)" />
            <Figure value="11.25%" label="most of the home's value counted for a couple (3 x 3.75%)" />
          </div>
          <p>
            So the maximum contribution based on the family home&apos;s value is 3 x 7.5% ={" "}
            <strong>22.5% of its value for a single person, or 3 x 3.75% = 11.25% for a couple</strong> (
            <Source href={`${HSE_FINANCIAL}#:~:text=11.25%25`}>HSE, Financial assessment</Source>).
          </p>

          <h3 className="font-heading text-lg font-semibold md:text-xl">What about the family farm or business?</h3>
          <p>
            Since 2021, the 3-year cap can also apply to a family farm or business, provided certain conditions are met. A
            family successor, who must be 18 or over, commits to running (not necessarily owning) the farm or business for
            at least six years (
            <Source href={`${HSE_FORM}#page=32`}>HSE, NHSS Application Form and Support Information, p.32</Source>). The
            farm or business must also have been actively running for at least 3 of the last 5 years before you went into
            care, and the successor can only be appointed once you are already in care. The HSE places a charge on the
            property. Note that selling a farm or business is treated differently from selling a home. A solicitor or the
            HSE can advise you on the specific conditions.
          </p>

          <h3 className="font-heading text-lg font-semibold md:text-xl">If you sell your home while in care</h3>
          <p>
            The 3-year cap follows the money. If you sell your home while in a nursing home, the sale proceeds also
            qualify for the cap, but the three years still run from when you went into care, not from the date of the sale
            (<Source href="https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/3-year-cap/">HSE, 3-year cap</Source>
            ). You must contact your local Nursing Homes Support Office within 10 working days of selling the property.
          </p>
        </GuideSection>

        <GuideSection id="nursing-home-loan">
          <p>
            Some people cannot cover their full contribution from income alone, particularly if most of what they own is
            their home. In that case, Fair Deal has an optional <strong>nursing home loan</strong>, officially called
            Ancillary State Support.
          </p>

          <h3 className="font-heading text-lg font-semibold md:text-xl">What it is</h3>
          <p>
            Instead of paying the part of your contribution that relates to your home every week, the HSE covers it for
            you. That amount builds up as a loan,{" "}
            <strong>tied to your home or other property within the State</strong> (
            <Source href={`${HSE_FORM}#page=26`}>HSE, NHSS Application Form and Support Information, p.26</Source>). You
            do not have to repay it while you are in the nursing home. If you sell or transfer the property while in care,
            the loan becomes due straight away. You must tell your local Nursing Homes Support Office within 10 working
            days and repay the loan to Revenue within 6 months of the sale or transfer, or interest will be charged (
            <Source href={`${HSE_FORM}#page=27`}>same source, p.27</Source>).
          </p>
          <p>
            After your death, it is paid back within 18 months (
            <Source href="https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/nursing-home-loan/">
              HSE, Nursing home loan
            </Source>
            ). The application form still says 12 months (p.27), so confirm this with your local Nursing Homes Support
            Office. Bankruptcy or false information on the application can also make the loan due immediately.
          </p>

          <Callout title="This is not a commercial bank loan">
            The loan amount is adjusted for inflation or deflation using the Consumer Price Index (CPI) while it builds up.
            If you apply to the HSE for the loan, the HSE pays the amount on your behalf and registers a charge on the
            property (p.26 of the application form above). If the loan isn&apos;t repaid within 18 months of death,
            interest is charged from the date of death. After a sale or transfer, interest is
            charged from 6 months after the sale.
          </Callout>

          <h3 className="font-heading text-lg font-semibold md:text-xl">Key things to know</h3>
          <ul className="flex flex-col gap-3">
            <Tick>
              You can apply for the nursing home loan when you apply for Fair Deal funding, or later if you are already a
              resident in a nursing home (p.26). Applying for both at the same time is recommended: a loan applied for later
              is only paid from its own approval date, and approval can take several months (p.3).
            </Tick>
            <Tick>
              Taking the loan is <strong>completely optional</strong>. You can instead pay the full amount from savings or
              income if you prefer.
            </Tick>
            <Tick>
              If your spouse or partner is still living in the family home, they must apply to the National Nursing Homes
              Support Office to defer repayment of the loan (p.28). This is not automatic. Deferral only applies if the
              loan is on your main home, and only if the house is their only residence, they lived in it for at least 3
              years before the original application for the loan, and they have no interest in any other property. The
              loan amount continues to rise with inflation (CPI) while deferred (
              <Source href="https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/nursing-home-loan/#:~:text=You%20can%20only%20defer">
                HSE, Nursing home loan
              </Source>
              ).
            </Tick>
            <Tick>
              The 3-year cap applies to the loan on your family home, the proceeds if you sell it, or a farm/business with
              an approved successor (
              <Source href={`${HSE_FORM}#page=30`}>HSE, NHSS Application Form and Support Information, p.30</Source>). A
              loan on any other land or property has no cap and continues to build for as long as you are in care. The cap
              limits the home-related contribution to 22.5% of its value for a single person, or 11.25% for a couple.
              Because the loan amount is adjusted for inflation while it builds up, the final amount actually repaid can be
              slightly more than that.
            </Tick>
          </ul>
        </GuideSection>

        <GuideSection id="how-to-apply">
          <Callout title="Funding cannot be backdated" warning>
            Start the application as early as you can. It is only paid from the date your application is approved, not
            from when you moved in.
          </Callout>
          <ol className="flex flex-col gap-3">
            <NumberedCard number={1}>
              <strong>Get the application form.</strong> Download it from{" "}
              <Source href="https://www.hse.ie/nhss/">hse.ie/nhss</Source> (available in both Irish and English) or
              collect it from your local Nursing Homes Support Office.
            </NumberedCard>
            <NumberedCard number={2}>
              <strong>Submit your form</strong> to your local Nursing Homes Support Office. You can do this yourself, or get
              help from a family member, solicitor, or social worker. The following people can apply on your behalf: your
              spouse or partner, a child or step-child aged 18 or over, a registered doctor, nurse, or social worker, or
              someone with a Registered Enduring Power of Attorney. A Decision-Making Representative appointed by the
              Circuit Court can also act on your behalf (
              <Source href="https://www.decisionsupportservice.ie/services/decision-making-representation-order/becoming-decision-making-representative">
                Decision Support Service
              </Source>
              ). If you also want the nursing home loan (see above) to cover the part of your contribution linked to your
              home, you can request it on the same form. It is optional and not automatic.
            </NumberedCard>
            <NumberedCard number={3}>
              <strong>Care needs assessment.</strong> The HSE will arrange a visit to assess whether you need long-term
              nursing home care. This is done by a healthcare professional, such as a public health nurse, a geriatrician or an
              occupational therapist (
              <Source href="https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/care-needs-assessment/">
                HSE, Care Needs Assessment
              </Source>
              ).
            </NumberedCard>
            <NumberedCard number={4}>
              <strong>Financial assessment.</strong> The HSE will look at your income and what you own to work out your
              weekly contribution. You will need to provide things like bank statements, details of any property you own,
              and your most recent tax notice from Revenue.
            </NumberedCard>
            <NumberedCard number={5}>
              <strong>Approval and nursing home selection.</strong> You don&apos;t need to wait for approval to start
              looking: you can shortlist and visit homes once your application is sent. If your application is approved,
              you will be told your weekly contribution. You can choose any nursing home approved for Fair Deal (public,
              voluntary, or a private home on the HSE&apos;s approved list). Your contribution amount stays the same
              regardless of which home you pick. It&apos;s a good idea to contact your preferred nursing home as soon as
              possible, as there can be waiting lists (
              <Source href={HSE_APPROVED_HOMES}>HSE, Finding the right nursing home</Source>).
            </NumberedCard>
          </ol>
          <Callout title="Important" warning>
            If you move into a nursing home before your Fair Deal is approved, you or your family will need to cover the
            full cost in the meantime. Fair Deal will not cover any costs from before your approval date.
          </Callout>
        </GuideSection>

        <GuideSection id="contacts">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONTACTS.map((contact) => (
              <li key={contact.who} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-5">
                <h3 className="flex items-center gap-3 font-semibold md:text-lg">
                  <OrganisationIcon kind={contact.kind} size="large" />
                  {contact.who}
                </h3>
                <p className="text-ink-muted">{contact.what}</p>
                <div className="mt-auto flex flex-col gap-1 pt-1">
                  {contact.link && <Source href={contact.link.href}>{contact.link.label}</Source>}
                  {/* A tap-to-call link, for phones. */}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone.replaceAll(" ", "")}`}
                      className="inline-flex w-fit items-center gap-1.5 font-semibold tap-target"
                    >
                      <Icon name="phone" />
                      Call {contact.phone}
                    </a>
                  )}
                  {contact.note && <span className="text-sm text-ink-muted">{contact.note}</span>}
                </div>
              </li>
            ))}
          </ul>
        </GuideSection>
      </div>

      {/* A tinted band the full width of the window, like the HIQA guide's checklist. */}
      <section aria-labelledby="remember-h" className={`${fullWidthClass} bg-band py-8 md:py-12`}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:px-8">
          <h2 id="remember-h" className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Key things to remember
          </h2>
          <ul className="grid max-w-4xl gap-3 sm:grid-cols-2">
            <RememberCard>
              Apply <strong>as early as possible</strong>. Funding only starts from the date of approval.
            </RememberCard>
            <RememberCard>
              You are free to choose <strong>any nursing home approved for Fair Deal</strong> (public, voluntary, or a
              private home on the HSE&apos;s approved list). Your contribution does not change based on which one you
              pick.
            </RememberCard>
            <RememberCard>
              The <strong>family home is protected</strong> after three years in care.
            </RememberCard>
            <RememberCard>
              The <strong>nursing home loan is optional</strong> and is not a commercial bank loan.
            </RememberCard>
            <RememberCard>
              If you need help filling in the forms, Citizens Information, ALONE, or a solicitor can all assist you.
            </RememberCard>
          </ul>
        </div>
      </section>

      <p className="max-w-4xl text-sm text-ink-muted italic">
        Fair Deal rules can change. Check <Source href="https://www.hse.ie/nhss/">hse.ie/nhss</Source> or call Citizens
        Information on{" "}
        <a href="tel:0818074000" className="tap-target">
          0818 07 4000
        </a>{" "}
        before making any decisions.
      </p>

      <GuideEnding current={guide} />
    </>
  );
}

// One numbered section of the guide, as a card that opens: its header has the number in a circle
// of brand colour, the title and what the section covers, with Show/Hide on the right, like the
// worked examples. The shared name makes the browser close the open section when another opens;
// the worked examples inside have none, so any number of them can be open. The id is the target of
// links into the guide, which SectionAccordion opens; scroll-mt keeps the header clear of the top
// of the window. "group/section", not "group", so the worked examples keep their own Show/Hide.
function GuideSection({ id, children }: { id: SectionId; children: ReactNode }) {
  const index = SECTIONS.findIndex((section) => section.id === id);
  const { title, description } = SECTIONS[index];
  return (
    <details
      id={id}
      name="fair-deal-sections"
      // SectionAccordion finds the sections by this. Written out: a constant from a "use client"
      // file reaches a server component as a client reference, not as its value.
      data-guide-section=""
      className={`${sectionScrollMargin} group/section rounded-lg border border-line bg-surface open:border-primary`}
    >
      {/* A summary may hold a heading but no wrapping block, so its parts are its own grid items:
          the number, the heading and description beside it, and Show/Hide on the right. */}
      <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 p-4 md:p-5 [&::-webkit-details-marker]:hidden">
        <span className="row-span-2">
          <StepNumber number={index + 1} />
        </span>
        <h2 className="col-start-2 font-heading text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
        <span className="col-start-2 text-ink-muted">{description}</span>
        <ShowHide group="section" className="col-start-3 row-span-2 row-start-1" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-line-soft px-4 pb-6 pt-4 leading-relaxed md:px-6">
        {children}
      </div>
    </details>
  );
}

// A link to a source, opening on its own site.
function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

// A number worth remembering, set large, on a card that shows on a tinted section or a plain one.
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-1 rounded-lg border border-line bg-surface px-5 py-4 sm:min-w-56">
      <span className="font-heading text-4xl font-semibold text-primary md:text-4xl">{value}</span>
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}

function NumberedCard({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-lg border border-line bg-surface p-5">
      <StepNumber number={number} size="small" />
      <p>{children}</p>
    </li>
  );
}

// A tick or a cross, always beside words that say the same, so it never relies on colour alone.
function Mark({ kind, small = false }: { kind: "yes" | "no"; small?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${small ? "mt-1 size-4" : "size-5"} ${kind === "yes" ? "text-success" : "text-danger"}`}
    >
      <path d={kind === "yes" ? "M5 12.5 10 17.5 19 7" : "M6 6l12 12M18 6 6 18"} />
    </svg>
  );
}

function NotCovered({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Mark kind="no" small />
      <span>{children}</span>
    </li>
  );
}

function Tick({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Mark kind="yes" small />
      <span>{children}</span>
    </li>
  );
}

// A point set apart, with a bar down its left side; a warning one in the warning colour.
function Callout({ title, warning = false, children }: { title: string; warning?: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border border-line border-l-4 bg-surface px-5 py-4 ${
        warning ? "border-l-warning" : "border-l-primary"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p>{children}</p>
    </div>
  );
}

// A worked example, as an accordion: its header says which kind of case it is and who it
// follows, and opening it shows the working and the highlighted total. Closed to begin with, so
// the three cases can be compared at a glance.
function Example({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-line bg-surface open:border-primary">
      {/* A summary may hold a heading but no wrapping block, so its parts are its own grid items:
          the heading (with the example's number) and description down the left, Show/Hide right. */}
      <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 p-5 md:p-6 [&::-webkit-details-marker]:hidden">
        <h3 className="col-start-1 flex flex-col gap-1 font-heading text-xl font-semibold">
          <span className="font-sans text-sm uppercase tracking-wider text-primary adult:normal-case adult:tracking-normal">
            Worked example {number}
          </span>
          {title}
        </h3>
        <span className="col-start-1 text-ink-muted">{description}</span>
        <ShowHide className="col-start-2 row-span-2 row-start-1" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-line-soft px-5 pb-5 pt-4 md:px-6 md:pb-6">{children}</div>
    </details>
  );
}

function Total({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-band px-4 py-3">{children}</p>;
}

function RememberCard({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
      <Mark kind="yes" small />
      <span>{children}</span>
    </li>
  );
}
