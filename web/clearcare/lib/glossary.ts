// lib/glossary.ts
// The words a family meets on ClearCare and in HIQA's and the HSE's own pages, each in plain words
// (CCARE-283), for the glossary under Resources. The page lists them A to Z; the groups are the
// categories it offers to narrow the list to, in this order. The terms are the ones participants in user testing
// stopped at or asked about: "substantially compliant" (P2_2, P2_3, P2_5), HIQA (P2_1), Fair Deal
// (none of the five Phase 2 participants knew it), the centre ID and "registered for" (P2_1), the
// price terms (P2_3), why the regulations differ from one inspection to the next (P2_2), the
// symbols (P2_4), a condition on a home's registration (P2_2), and the HSE's look at a family's
// money (Phase 1, General User 5). The rest are words the site and the reports use beside them.
//
// Each meaning agrees with the page that says more: the judgements are HIQA's own, from
// JUDGEMENT_MEANINGS (components/centre/judgement-icon.tsx), and the Fair Deal terms follow the Fair
// Deal guide and its sources. Change one with the other. A term's id is its anchor on the page
// (/resources/glossary#<id>), so keep ids as they are once published: other pages may link to them.
import type { Judgement } from "./centres";

export type GlossaryLink = { href: string; label: string };

export type GlossaryTerm = {
  id: string;
  term: string;
  // What the term is filed under A to Z, when not its own spelling: "3-year cap" under T.
  sortAs?: string;
  // Other names for the same thing: older ClearCare wording, or what HIQA or the HSE call it.
  aka?: string[];
  // The meaning in plain words, a sentence or a few.
  meaning: string;
  // A HIQA judgement: the page shows its symbol and HIQA's own definition under the plain words.
  judgement?: Judgement;
  more?: GlossaryLink;
};

export type GlossaryGroup = {
  id: string;
  title: string;
  summary: string;
  terms: GlossaryTerm[];
};

const READING_REPORTS: GlossaryLink = { href: "/guides/reading-inspection-reports", label: "Making Sense of a HIQA Inspection Report" };
const fairDeal = (section: string): GlossaryLink => ({ href: `/guides/fair-deal#${section}`, label: "Fair Deal Explained" });

export const GLOSSARY: GlossaryGroup[] = [
  {
    id: "inspections",
    title: "Inspections",
    summary: "Who inspects nursing homes, and what their reports contain.",
    terms: [
      {
        id: "hiqa",
        term: "HIQA",
        aka: ["Health Information and Quality Authority"],
        meaning:
          "The independent body that registers and inspects every nursing home in Ireland. After each inspection it publishes a report, and the inspection results on ClearCare come from those reports.",
        more: READING_REPORTS,
      },
      {
        id: "inspection-report",
        term: "Inspection report",
        meaning:
          "What HIQA's inspectors write after visiting a home. It sets out what they saw on the day, a judgement for each regulation they looked at, and the home's compliance plan.",
        more: READING_REPORTS,
      },
      {
        id: "regulation",
        term: "Regulation",
        meaning:
          "A legal requirement every nursing home must meet, such as Fire precautions or Infection control. Inspectors judge a home against them. An inspection doesn't look at every regulation, so the list can be different from one inspection to the next.",
      },
      {
        id: "unannounced-inspection",
        term: "Unannounced inspection",
        meaning: "An inspection the home isn't told about in advance, so inspectors see it as it usually is.",
      },
      {
        id: "announced-inspection",
        term: "Announced inspection",
        meaning: "An inspection the home is told about beforehand. HIQA gives four weeks' notice.",
      },
      {
        id: "thematic-inspection",
        term: "Thematic inspection",
        meaning:
          "An inspection that looks closely at one topic, rather than across the regulations. It is judged against HIQA's National Standards and gives one overall judgement.",
      },
      {
        id: "national-standards",
        term: "National Standards",
        meaning:
          "HIQA's description of what good care in a nursing home looks like, published in 2016. Inspectors use them alongside the regulations.",
      },
      {
        id: "compliance-plan",
        term: "Compliance plan",
        meaning:
          "The home's written reply to an inspection. It says what the home will do, and by when, about each regulation that wasn't fully met. A later inspection shows whether it was kept.",
        more: READING_REPORTS,
      },
      {
        // Next to the compliance plan, which it is easily taken for: one is about a resident, the
        // other about the home. The meaning follows HIQA's National Standard 2.1, quoted for
        // Regulation 5 in lib/regulations.ts.
        id: "care-plan",
        term: "Care plan",
        meaning:
          "A written plan for one resident where it sets out what care and support they need, based on an assessment of their needs and their wishes, and how the home will give it. It is reviewed as their needs change and inspectors check care plans under the regulation Individual assessment and care plan.",
      },
      {
        id: "risk-rating",
        term: "Risk rating",
        aka: ["High risk", "Moderate risk", "Low risk"],
        meaning:
          "HIQA's rating for each item of a compliance plan, which its reports show as red (high), orange (moderate) or yellow (low). It tells you how serious HIQA judged the risk to residents to be.",
      },
    ],
  },
  {
    id: "judgements",
    title: "Inspection results",
    summary: "The judgement HIQA gives each regulation an inspection looks at, and the symbol ClearCare shows for it.",
    terms: [
      {
        id: "compliant",
        term: "Compliant",
        meaning: "The home fully met the regulation standards at the time of the inspection.",
        judgement: "compliant",
      },
      {
        id: "substantially-compliant",
        term: "Substantially compliant",
        meaning:
          "The home mostly met the regulation, but something still needed fixing to meet it fully. It is a milder result than not compliant.",
        judgement: "substantially-compliant",
      },
      {
        id: "not-compliant",
        term: "Not compliant",
        meaning: "The home didn't meet the regulation, and major changes were needed for it to do so.",
        judgement: "not-compliant",
      },
      {
        id: "not-assessed",
        term: "Not assessed",
        meaning:
          "ClearCare's words for a regulation an inspection didn't look at. This does not mean the regulation has been met or not.",
        judgement: "not-assessed",
      },
    ],
  },
  {
    id: "the-home",
    title: "The home and its registration",
    summary: "What HIQA's register says about each home.",
    terms: [
      {
        id: "registration",
        term: "Registration",
        meaning:
          "A nursing home must be registered with HIQA to open. A registration lasts three years and names who runs the home and how many residents it may have.",
      },
      {
        id: "centre-id",
        term: "Centre ID",
        meaning:
          "The number HIQA gives each home. HIQA's register and reports use it, so it helps you find the right home's reports on hiqa.ie when two homes have similar names.",
      },
      {
        id: "maximum-occupancy",
        term: "Maximum occupancy",
        meaning: "The most residents HIQA allows the home to have.",
      },
      {
        id: "registered-provider",
        term: "Registered provider",
        meaning: "The person or organisation legally responsible for running the home, as named on HIQA's register.",
      },
      {
        id: "person-in-charge",
        term: "Person in charge",
        meaning: "The nurse who manages the home day to day, named to HIQA.",
      },
      {
        id: "extra-condition",
        term: "Extra condition on a registration",
        meaning:
          "A rule HIQA adds to a home's registration on top of the usual ones, for example that it takes no new residents until building work is finished. ClearCare shows any at the top of the home's page.",
      },
      {
        id: "designated-centre",
        term: "Designated centre",
        meaning: "The legal name for a place HIQA registers. HIQA's reports call a nursing home a designated centre for older people.",
      },
    ],
  },
  {
    // One term for each care type the search can filter by, spelt as the filter labels it
    // (FILTER_GROUPS in lib/search-filters.ts); tests/glossary.test.ts holds the two together.
    id: "care-types",
    title: "Care types",
    summary: "The kinds of care a home may offer, and that you can filter a search by.",
    terms: [
      {
        id: "long-term-residential-care",
        term: "Long-term residential care",
        meaning:
          "Living in a nursing home permanently, with care day and night, usually when someone can no longer manage at home. This is the care Fair Deal helps pay for.",
        more: fairDeal("what-is-fair-deal"),
      },
      {
        id: "dementia-care",
        term: "Dementia care",
        meaning:
          "Care for people living with dementia. Some homes have a separate unit for it, designed to be safe and easy to find your way around, with staff trained in dementia care.",
      },
      {
        id: "respite-care",
        term: "Respite care",
        meaning:
          "A short stay, often a week or two, that gives the person who usually cares for someone at home a break.",
      },
      {
        id: "convalescent-care",
        term: "Convalescent care",
        meaning: "A short stay to recover after an illness, an operation or a hospital stay, before going home.",
      },
      {
        id: "step-down-care",
        term: "Step-down care",
        meaning:
          "A short stay for someone well enough to leave hospital but not yet ready to go home. It is often arranged by the hospital.",
      },
      {
        id: "transitional-care",
        term: "Transitional care",
        meaning:
          "A short stay for someone leaving hospital who isn't ready to go home, or who is waiting for a long-term place. The HSE may pay for it for a limited time, for example while a Fair Deal application is decided.",
      },
      {
        id: "short-term-care",
        term: "Short-term care",
        meaning:
          "Any stay with an end date, such as respite, convalescent or step-down care, rather than living in the home permanently.",
      },
      {
        id: "palliative-care",
        term: "Palliative care",
        meaning:
          "Care that eases pain and other symptoms for someone with a serious illness that can't be cured, so they are as comfortable as possible. It is not only for the end of life.",
      },
      {
        id: "end-of-life-care",
        term: "End-of-life care",
        meaning:
          "Care in the last weeks and days of someone's life, keeping them comfortable and supporting their family.",
      },
      {
        id: "general-nursing-care",
        term: "General nursing care",
        meaning:
          "Everyday care from nurses and care staff, such as giving medicines, looking after wounds, and helping with washing, dressing and eating.",
      },
      {
        id: "rehabilitation",
        term: "Rehabilitation",
        meaning:
          "Therapy, such as physiotherapy or occupational therapy, to help someone get back strength and independence after an illness, injury or operation.",
      },
      {
        id: "day-care",
        term: "Day care",
        meaning:
          "Care during the day for someone who still lives at home: meals, activities and company, then home in the evening.",
      },
      {
        id: "physical-disability-care",
        term: "Physical disability care",
        meaning:
          "Care for people with a physical disability who need help moving about and with daily tasks. Some homes take younger adults for it.",
      },
      {
        id: "intellectual-disability-care",
        term: "Intellectual disability care",
        meaning: "Care for people with an intellectual disability, including as their needs change with age.",
      },
      {
        id: "mental-health-care",
        term: "Mental health care",
        meaning: "Care for residents living with a long-term mental health condition.",
      },
      {
        id: "acquired-brain-injury-care",
        term: "Acquired brain injury care",
        meaning:
          "Care for someone whose brain was damaged during their life, for example by a fall, a stroke or an infection, rather than from birth.",
      },
      {
        id: "neurological-care",
        term: "Neurological care",
        meaning:
          "Care for conditions of the brain and nerves, such as Parkinson's disease, multiple sclerosis or motor neurone disease.",
      },
      {
        id: "sensory-impairment-care",
        term: "Sensory impairment care",
        meaning: "Care for residents with sight or hearing loss.",
      },
    ],
  },
  {
    id: "paying",
    title: "Paying for care",
    summary: "Fair Deal and the words that come with it.",
    terms: [
      {
        id: "fair-deal",
        term: "Fair Deal",
        aka: ["Nursing Homes Support Scheme", "NHSS"],
        meaning:
          "The government scheme that helps pay for long-term nursing home care. You pay what you can reasonably afford, and the HSE pays the rest.",
        more: fairDeal("what-is-fair-deal"),
      },
      {
        id: "hse",
        term: "HSE",
        aka: ["Health Service Executive"],
        meaning: "The body that runs Ireland's public health services, including Fair Deal and public nursing homes.",
      },
      {
        id: "full-weekly-cost",
        term: "Full weekly cost",
        aka: ["Contract price", "Maximum contract price"],
        meaning:
          "The weekly price of a resident's care that the HSE agreed with the home for Fair Deal, from the HSE's price list. It is the whole price, not what your family pays. Fair Deal works out your share of it. Extra charges aren't included.",
        more: fairDeal("how-much-will-you-pay"),
      },
      {
        id: "extra-charges",
        term: "Extra charges",
        meaning:
          "What Fair Deal doesn't pay for, such as hairdressing, outings, or personal items.",
        more: fairDeal("what-does-fair-deal-cover"),
      },
      {
        id: "care-needs-assessment",
        term: "Care needs assessment",
        meaning: "The check, as part of a Fair Deal application, that you need full-time nursing home care.",
        more: fairDeal("how-to-apply"),
      },
      {
        id: "financial-assessment",
        term: "Financial assessment",
        meaning:
          "How the HSE works out what you pay towards your care under Fair Deal. You pay 80% of your income, and 7.5% a year of what you own above the disregard. It decides your share, not whether you can have Fair Deal.",
        more: fairDeal("how-much-will-you-pay"),
      },
      {
        id: "disregard",
        term: "Disregard",
        meaning: "The part of what you own that the financial assessment doesn't count. This is the first €36,000 for a single person, or €72,000 for a couple.",
        more: fairDeal("how-much-will-you-pay"),
      },
      {
        id: "three-year-cap",
        term: "3-year cap",
        sortAs: "Three-year cap",
        meaning:
          "Your family home counts in the financial assessment for three years at most. After that it isn't counted at all, however long you stay in care.",
        more: fairDeal("three-year-cap"),
      },
      {
        id: "nursing-home-loan",
        term: "Nursing home loan",
        aka: ["Ancillary State Support"],
        meaning:
          "An optional part of Fair Deal. The HSE pays the share of your contribution that comes from your home or other property, and it is repaid later, usually from your estate. You don't repay it while you are in care.",
        more: fairDeal("nursing-home-loan"),
      },
      {
        id: "nursing-homes-support-office",
        term: "Nursing Homes Support Office",
        meaning: "Your local HSE office for Fair Deal. It handles applications and answers questions about them.",
        more: { href: "/contacts", label: "Support Services" },
      },
    ],
  },
];

// A judgement's plain words, as the glossary gives them, for the key over a home's inspection history
// (components/centre/inspection-history.tsx), so the two say the same thing.
export function judgementMeaning(judgement: Judgement): string {
  const term = GLOSSARY.flatMap((group) => group.terms).find((each) => each.judgement === judgement);
  if (!term) throw new Error(`The glossary has no term for the judgement ${judgement}`);
  return term.meaning;
}
