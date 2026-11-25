// lib/regulations.ts
// What each regulation is about, shown when a family hovers over or taps a regulation's title
// (CCARE-278). In user testing (P2_4) the participant didn't know what "Premises" meant, and the
// titles are HIQA's, kept as they are.
//
// Every word here is quoted from HIQA, never ClearCare's own summary: HIQA's "Assessment-judgment
// framework for designated centres for older people", Version 4.1, May 2025
// (https://hiqa.ie/sites/default/files/2025-03/AJF-DCOP-Guidance.pdf). For each regulation the
// framework gives the National Standards (National Standards for Residential Care Settings for Older
// People in Ireland, 2016) it is assessed against, and its "lines of enquiry", the questions
// inspectors ask. A regulation with a standard quotes it, being the plainer of the two; one without
// quotes a line of enquiry. Where the framework lists a question's parts as a list, they're run
// together here with the framework's own words and punctuation. Check them against the framework
// when it's revised.
import type { Regulation } from "./centres";

export const REGULATIONS_SOURCE = {
  title: "HIQA, Assessment-judgment framework for designated centres for older people, Version 4.1, May 2025",
  url: "https://hiqa.ie/sites/default/files/2025-03/AJF-DCOP-Guidance.pdf",
};

// The works the regulations page (app/(site)/resources/regulations, CCARE-261) cites, in its
// reference list. The framework is where every quote here was taken from; the standards are what a
// "standard" quote is from; the statutory instrument is where the regulations and their numbers are
// set down in law.
export const REGULATION_REFERENCES = {
  framework: {
    id: "ref-framework",
    cite: "HIQA, 2025",
    author: "Health Information and Quality Authority",
    year: "2025",
    title: "Assessment-judgment framework for designated centres for older people",
    detail: "Version 4.1. Dublin: HIQA.",
    url: REGULATIONS_SOURCE.url,
  },
  standards: {
    id: "ref-standards",
    cite: "HIQA, 2016",
    author: "Health Information and Quality Authority",
    year: "2016",
    title: "National Standards for Residential Care Settings for Older People in Ireland",
    detail: "Dublin: HIQA.",
    url: "https://www.hiqa.ie/reports-and-publications/standard/national-standards-residential-care-settings-older-people-ireland",
  },
  regulations: {
    id: "ref-regulations",
    cite: "S.I. No. 415 of 2013",
    author: "Government of Ireland",
    year: "2013",
    title: "Health Act 2007 (Care and Welfare of Residents in Designated Centres for Older People) Regulations 2013",
    detail: "S.I. No. 415 of 2013. Dublin: Stationery Office.",
    url: "https://www.irishstatutebook.ie/eli/2013/si/415/made/en/print",
  },
} as const;

// standard: the National Standard's number, its words quoted. enquiry: one of the framework's lines of
// enquiry for the regulation, quoted.
export type RegulationQuote = { kind: "standard"; standard: string; text: string } | { kind: "enquiry"; text: string };

type RegulationEntry = {
  // The title as the framework gives it, and any other title a report uses for the same one.
  titles: string[];
  quote: RegulationQuote;
};

const standard = (number: string, text: string): RegulationQuote => ({ kind: "standard", standard: number, text });
const enquiry = (text: string): RegulationQuote => ({ kind: "enquiry", text });

const REGULATIONS: Record<number, RegulationEntry> = {
  3: {
    titles: ["Statement of purpose"],
    quote: standard("5.3", "The residential service has a publicly available statement of purpose that accurately describes the services provided."),
  },
  4: {
    titles: ["Written policies and procedures"],
    quote: enquiry("Has the provider prepared in writing, adopted and implemented policies and procedures on the matters set out in Schedule 5 of the regulations?"),
  },
  5: {
    titles: ["Individual assessment and care plan"],
    quote: standard(
      "2.1",
      "Each resident has a care plan, based on an ongoing comprehensive assessment of their needs which is implemented, evaluated and reviewed, reflects their changing needs and outlines the support required to maximise their quality of life in accordance with their wishes.",
    ),
  },
  6: {
    titles: ["Health care"],
    quote: standard("4.1", "The health and wellbeing of each resident is promoted and they are given appropriate support to meet any identified healthcare needs"),
  },
  7: {
    titles: ["Managing behaviour that is challenging"],
    quote: standard("4.3", "Each resident experiences care that supports their physical, behavioural and psychological wellbeing."),
  },
  8: {
    titles: ["Protection"],
    quote: standard("3.1", "Each resident is safeguarded from abuse and neglect and their safety and welfare is promoted."),
  },
  9: {
    titles: ["Residents' rights"],
    quote: standard("1.1", "The rights and diversity of each resident are respected and safeguarded."),
  },
  10: {
    titles: ["Communication", "Communication difficulties"],
    quote: standard("1.5", "Each resident has access to information, provided in a format appropriate to their communication needs and preferences."),
  },
  11: {
    titles: ["Visits"],
    quote: enquiry("Has the provider made arrangements for a resident to receive visitors?"),
  },
  12: {
    titles: ["Personal possessions"],
    quote: standard("3.6", "Each resident's personal property and finances are managed and protected."),
  },
  13: {
    titles: ["End of life care", "End of life"],
    quote: standard(
      "2.5",
      "Each resident continues to receive care at the end of their life which respects their dignity and autonomy and meets their physical, emotional, social and spiritual needs.",
    ),
  },
  14: {
    titles: ["Persons in charge", "Person in charge"],
    quote: enquiry(
      "Where the provider is not the person in charge, is the person in charge a registered nurse with not less than 3 years' experience of nursing older persons within the previous six years?",
    ),
  },
  15: {
    titles: ["Staffing"],
    quote: enquiry(
      "Has the provider ensured that the number and skill-mix of staff is appropriate having regard to the needs of the residents, assessed in accordance with Regulation 5, and the size and layout of the designated centre concerned?",
    ),
  },
  16: {
    titles: ["Training and staff development"],
    quote: standard("7.4", "Training is provided to staff to improve outcomes for all residents."),
  },
  17: {
    titles: ["Premises"],
    quote: standard("2.6", "The residential service is homely and accessible and provides adequate physical space to meet each resident's assessed needs."),
  },
  18: {
    titles: ["Food and nutrition"],
    quote: standard("2.2", "Each resident's needs in relation to hydration and nutrition are met and meals and mealtimes are an enjoyable experience."),
  },
  19: {
    titles: ["Directory of residents"],
    quote: enquiry("Has the provider established and maintained a directory of residents in the designated centre?"),
  },
  20: {
    titles: ["Information for residents"],
    quote: enquiry("Has the provider prepared and made available to residents a guide in respect of the designated centre?"),
  },
  21: {
    titles: ["Records"],
    quote: standard(
      "8.2",
      "Information governance arrangements ensure secure record-keeping and file-management systems are in place to deliver a person-centred safe and effective service.",
    ),
  },
  22: {
    titles: ["Insurance"],
    quote: enquiry("Has the provider effected a contract of insurance against injury to residents?"),
  },
  23: {
    titles: ["Governance and management"],
    quote: standard("5.2", "The residential service has effective leadership, governance and management arrangements in place and clear lines of accountability."),
  },
  24: {
    titles: ["Contract for the provision of services"],
    quote: standard("2.8", "Each resident's access to residential services is determined on the basis of fair and transparent criteria."),
  },
  25: {
    titles: ["Temporary absence or discharge of residents"],
    quote: enquiry(
      "Has the person in charge ensured, in so far as practicable, that a resident is discharged from the designated centre concerned in a planned and safe manner?",
    ),
  },
  26: {
    titles: ["Risk management"],
    quote: standard("3.2", "The residential service has effective arrangements in place to manage risk and protect residents from the risk of harm."),
  },
  27: {
    titles: ["Infection control", "Protection against infection"],
    quote: standard("3.3", "Infection prevention and control practices achieve the best outcomes for residents."),
  },
  28: {
    titles: ["Fire precautions"],
    quote: enquiry(
      "Has the provider: taken adequate precautions against the risk of fire, and provided suitable firefighting equipment, suitable building services, and suitable bedding and furnishing?",
    ),
  },
  29: {
    titles: ["Medicines and pharmaceutical services"],
    quote: standard("3.4", "Each resident is protected through the residential service's policies and procedures for medicines management."),
  },
  30: {
    titles: ["Volunteers"],
    quote: enquiry(
      "Has the person in charge ensured that people involved on a voluntary basis with the designated centre: have their roles and responsibilities set out in writing, received supervision and support, and have a vetting disclosure in accordance with the National Vetting Bureau (Children and Vulnerable Persons) Act 2012?",
    ),
  },
  31: {
    titles: ["Notification of incidents"],
    quote: enquiry(
      "Where an incident set out in paragraph 7(1)(a) to (i) of Schedule 4 of the regulations occurs, has the person in charge given notice in writing of the incident within 2 working days of its occurrence?",
    ),
  },
  32: {
    titles: ["Notification of absence"],
    quote: enquiry(
      "Where the person in charge of the designated centre proposes to be absent from the designated centre for a continuous period of 42 days or more, has the provider given notice in writing to the Chief Inspector of the proposed absence?",
    ),
  },
  33: {
    titles: [
      "Notification of procedures and arrangements for periods when person in charge is absent from the designated centre",
    ],
    quote: enquiry(
      "Where the provider gives notice of the absence of the person in charge from the designated centre under Regulation 32, does the notice include details of the deputising arrangements that will be in place for the management of the designated centre during that absence up to a 6 month period of time?",
    ),
  },
  34: {
    titles: ["Complaints procedure", "Complaints"],
    quote: standard("1.7", "Each resident's complaints and concerns are listened to and acted upon in a timely, supportive and effective manner."),
  },
};

// Titles compared without case, extra spaces, a curly apostrophe or a full stop at the end.
const normalise = (title: string) =>
  title.toLowerCase().replaceAll("’", "'").replace(/\s+/g, " ").replace(/\.$/, "").trim();

// One regulation as the regulations page lists it: HIQA's words for it, or, for the two the
// framework doesn't cover, ClearCare's own short summary, which the page labels as ours.
export type RegulationListing =
  | { number: number; title: string; quote: RegulationQuote }
  | { number: number; title: string; summary: string };

// Regulations 1 and 2 name the regulations and define their words, so there is nothing in them to
// inspect and the framework gives no words for them. They are only on the regulations page, never
// the hover: no report judges them. Their titles are the statutory instrument's (S.I. No. 415 of
// 2013); check them against it, as irishstatutebook.ie refuses automated requests.
const UNINSPECTED: { number: number; title: string; summary: string }[] = [
  { number: 1, title: "Citation and commencement", summary: "Gives the regulations their name and says when they came into force." },
  { number: 2, title: "Definitions", summary: "Explains what the words used in the regulations mean." },
];

// Every regulation, by number, for the regulations page (CCARE-261): each one HIQA inspects under
// the title the framework gives it, with HIQA's words, and the first two with ClearCare's summary.
export function allRegulations(): RegulationListing[] {
  const inspected = Object.entries(REGULATIONS).map(([number, entry]) => ({
    number: Number(number),
    title: entry.titles[0],
    quote: entry.quote,
  }));
  return [...UNINSPECTED, ...inspected].sort((a, b) => a.number - b.number);
}

// The anchor of a regulation on the regulations page: /resources/regulations#regulation-17.
export function regulationAnchor(number: number): string {
  return `regulation-${number}`;
}

// HIQA's words for a regulation, or null when ClearCare has none. Matched by number and title
// together: the registration regulations have numbers of their own, so a number alone could give
// another regulation's words.
export function regulationQuote({ number, title }: Regulation): RegulationQuote | null {
  const entry = REGULATIONS[number];
  if (!entry) return null;
  return entry.titles.some((known) => normalise(known) === normalise(title)) ? entry.quote : null;
}
