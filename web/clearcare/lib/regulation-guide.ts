// lib/regulation-guide.ts
// ClearCare's own words about each regulation, for the regulations page (CCARE-261): the theme it is
// grouped under, a plain-English line on what it means, and for the ones a family sees for
// themselves, a question to ask on a visit. Kept apart from lib/regulations.ts, which holds HIQA's
// words only and is quoted as theirs; the page shows these first and HIQA's quote under them.
//
// Each summary is drawn from the HIQA quote beside it and says no more than it does, except where a
// comment says otherwise: those lines need checking against the regulation itself (S.I. No. 415 of
// 2013) before they are relied on. tests/regulation-guide.test.ts checks every inspected regulation
// has a theme and a summary.
import type { Tint } from "@/components/ui/icon-circle";
import type { IconName } from "@/components/ui/icons";

export type RegulationTheme = {
  id: string;
  title: string;
  intro: string;
  icon: IconName;
  tint: Tint;
  regulations: number[];
};

export type RegulationGuide = {
  // What the regulation means for a resident or a family, in a sentence.
  plain: string;
  // A question a family could ask when they visit, for the regulations they can see for themselves.
  ask?: string;
  // Where the plain line follows an amendment rather than the 2013 text as made, the amending
  // instrument, cited after the line (CCARE-306): the reference list's link to S.I. No. 415 of 2013
  // is the text as made, so a reader who followed it found the old numbers (PR #233 review).
  amendedBy?: "careRegulations2025";
};

// In the order a family thinks of a home: what a day there is like first, the paperwork last.
export const REGULATION_THEMES: RegulationTheme[] = [
  {
    id: "daily-life",
    title: "Daily life and dignity",
    intro: "How residents are treated, and what their days in the home are like.",
    icon: "home",
    tint: "sage",
    regulations: [9, 10, 11, 12, 13, 17, 18, 20, 25, 34],
  },
  {
    id: "health",
    title: "Health and care",
    intro: "Each resident's care plan, their medical care and their medicines.",
    icon: "heart",
    tint: "rose",
    regulations: [5, 6, 7, 29],
  },
  {
    id: "safety",
    title: "Safety",
    intro: "Keeping residents safe from harm, abuse, infection and fire.",
    icon: "shield",
    tint: "gold",
    regulations: [8, 26, 27, 28],
  },
  {
    id: "staff",
    title: "Staff and leadership",
    intro: "Who runs the home, and the people who care for residents.",
    icon: "people",
    tint: "blue",
    regulations: [14, 15, 16, 23, 30, 32, 33],
  },
  {
    id: "records",
    title: "Records and paperwork",
    intro: "The documents a home must keep, and what it must tell HIQA.",
    icon: "report",
    tint: "band",
    regulations: [3, 4, 19, 21, 22, 24, 31],
  },
];

// The theme a regulation is grouped under, or null for one that isn't inspected (1 and 2). The one
// lookup every page uses (CCARE-298), so a home's findings carry the same icon and tint as the
// regulations page. The themes are ClearCare's grouping, not HIQA's.
const THEME_BY_REGULATION = new Map(REGULATION_THEMES.flatMap((theme) => theme.regulations.map((number) => [number, theme] as const)));

export function regulationTheme(number: number): RegulationTheme | null {
  return THEME_BY_REGULATION.get(number) ?? null;
}

export const REGULATION_GUIDE: Record<number, RegulationGuide> = {
  3: {
    plain: "The home must publish an accurate description of the services it provides.",
    ask: "Can I see your statement of purpose?",
  },
  4: { plain: "The home must have written policies on the topics the regulations list, and follow them." },
  5: {
    plain:
      "Each resident should have a written care plan, based on an assessment of their needs and wishes, that is followed and reviewed as their needs change.",
    ask: "How often are care plans reviewed, and can our family be involved?",
  },
  6: {
    plain: "Residents' health should be looked after, with support to get the medical care they need.",
    ask: "How do residents see a GP, and how quickly?",
  },
  7: {
    // "For example because of dementia" is ClearCare's example, not in HIQA's quote: check it.
    plain:
      "Residents whose behaviour can be challenging, for example because of dementia, should get care that supports their physical and emotional wellbeing.",
    ask: "How do staff support a resident who becomes distressed or agitated?",
  },
  8: {
    plain: "Residents must be kept safe from abuse and neglect.",
    ask: "Who would I speak to if I was worried about how a resident was treated?",
  },
  9: {
    plain: "Each resident's rights, choices and background should be respected.",
    ask: "Can residents choose when they get up, eat and go to bed?",
  },
  10: {
    plain: "Residents should get information in a way they can understand, suited to how they communicate.",
    ask: "How do you help residents with hearing, sight or speech difficulties?",
  },
  11: {
    plain: "The home must make arrangements for residents to have visitors.",
    ask: "Are there set visiting times, and is there somewhere private to visit?",
  },
  12: {
    plain: "Residents' belongings and money must be looked after and protected.",
    ask: "How are residents' belongings and money kept safe?",
  },
  13: {
    plain:
      "At the end of their life, residents should get care that respects their dignity and wishes and meets their physical, emotional, social and spiritual needs.",
    ask: "Can family stay with a resident at the end of their life?",
  },
  14: {
    // "In most homes": the nursing requirement doesn't apply where the provider is a doctor running
    // the home themselves, or where no resident needs full-time nursing care (S.I. No. 415 of 2013,
    // read in the PR #233 review; CCARE-306). HIQA's question also applies only where the provider
    // isn't the person in charge.
    plain:
      "The home must have a person in charge who manages it day to day. In most homes they must be a registered nurse with at least three years' experience of nursing older people in the last six years.",
    ask: "Who is the person in charge, and how long have they been here?",
  },
  15: {
    plain:
      "The home must have enough staff, with the right skills, for its residents' needs and the size and layout of the building.",
    ask: "How many staff are on duty at night?",
  },
  16: {
    plain: "Staff must be trained to give residents good care.",
    ask: "What training do care staff get, for example in dementia care?",
  },
  17: {
    plain: "The building should feel homely, be easy to get around, and have enough space for each resident's needs.",
    ask: "Can residents bring their own furniture and belongings?",
  },
  18: {
    plain: "Residents should get enough to eat and drink, suited to their needs, and mealtimes should be enjoyable.",
    ask: "Can residents choose what and when they eat?",
  },
  19: { plain: "The home must keep an up-to-date register of its residents." },
  20: {
    plain: "The home must give residents a guide to the home.",
    ask: "Can I have a copy of your residents' guide?",
  },
  21: { plain: "The home must keep its records accurate and secure." },
  22: { plain: "The home must be insured against injury to residents." },
  23: { plain: "The home must be well run, with clear leadership and clear responsibility for decisions." },
  24: {
    // HIQA's quote is about places being offered on fair terms; "a written contract" comes from the
    // regulation's title: check it.
    plain: "Each resident should have a written contract, and places should be offered on fair and open terms.",
    ask: "Can I see the contract, including any extra charges, before we decide?",
  },
  25: {
    // HIQA's quote is about discharge only. What the regulation says about a temporary absence, such
    // as a stay in hospital, is that the resident's information goes with them and comes back with
    // them, not that the absence is planned (S.I. No. 415 of 2013, read in the PR #233 review;
    // CCARE-306).
    plain:
      "When a resident goes into hospital or is away for a time, the home must send the information needed for their care with them, and get it back when they return. When a resident leaves for good, it should be planned and safe.",
    ask: "What happens to a resident's place if they go into hospital?",
  },
  26: { plain: "The home must have good arrangements to manage risks and protect residents from harm." },
  27: {
    plain: "The home must follow good practice to prevent and control infection.",
    ask: "How do you handle an outbreak of something like flu or COVID-19?",
  },
  28: {
    plain:
      "The home must take proper precautions against fire, with suitable firefighting equipment, building services, bedding and furnishings.",
    ask: "How often do you hold fire drills, including at night?",
  },
  29: {
    plain: "Medicines must be managed safely, following the home's own policies.",
    ask: "Who gives residents their medicines, and how often are they reviewed?",
  },
  30: {
    // HIQA's quote says "a vetting disclosure" under the National Vetting Bureau Act 2012, which is
    // Garda vetting: check the wording.
    plain: "Volunteers must have their role written down, be supervised and supported, and be Garda vetted.",
  },
  31: {
    // HIQA's question says notice in writing; that it goes to HIQA's Chief Inspector is from the
    // regulation: check it. Two working days since S.I. No. 98 of 2025; three in the 2013 text as made.
    plain: "The home must tell HIQA in writing about certain serious incidents within two working days.",
    amendedBy: "careRegulations2025",
  },
  32: {
    // 42 days since S.I. No. 98 of 2025; 28 in the 2013 text as made.
    plain: "The home must tell HIQA in advance if the person in charge will be away for 42 days or more.",
    amendedBy: "careRegulations2025",
  },
  33: { plain: "When it does, the home must say who will manage it while the person in charge is away." },
  34: {
    plain: "Residents' complaints and concerns should be listened to and dealt with promptly and fairly.",
    ask: "How do I make a complaint, and who deals with it?",
  },
};
