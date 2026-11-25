// lib/references.ts
// Every outside source a ClearCare page cites in its References (CCARE-299), written once so a
// source reads the same on every page that uses it. Each page picks the ones it relies on and lists
// them under a folded References section (components/ui/references.tsx); an in-text citation ("HIQA,
// 2025") leads to its entry there.
//
// Harvard style: author, year, title, then what kind of document and who published it. "n.d." where
// the source gives no date: most of the HSE's and other bodies' web pages carry none. Every link
// here was already on the site, checked when it was added (Resources, CCARE-233; Fair Deal
// Explained; the regulations page, CCARE-261). hiqa.ie and irishstatutebook.ie refuse automated
// requests, so check those by hand.

// The name a page uses to pick a source: "hseFinancialAssessment".
export type SourceKey = keyof typeof REFERENCES;

export type Source = {
  // The entry's anchor on its page: /guides/fair-deal#ref-hse-financial-assessment.
  id: string;
  // The author as an in-text citation names them: "HSE" for the Health Service Executive.
  short?: string;
  // The whole in-text citation, for a source not cited by author and year, such as a statute.
  cite?: string;
  author: string;
  // The year, or "n.d." where the source gives none.
  year: string;
  title: string;
  // What kind of document it is and who published it, ending in a full stop.
  detail: string;
  url: string;
};

// A source as one page lists it: its in-text citation, and the year as the list shows it, lettered
// where the page cites two by the same author in the same year ("HSE, n.d.a", "HSE, n.d.b").
export type Reference = Source & { cite: string; shownYear: string };

const ref = (source: Source) => source;

// The sources a page cites, in the order its list shows them (by author, then year, then title),
// each with its in-text citation. Letters are the page's own, so they restart on every page.
export function pageReferences<K extends keyof typeof REFERENCES>(keys: readonly K[]): Record<K, Reference> & { list: Reference[] } {
  const sources = keys
    .map((key) => ({ key, source: REFERENCES[key] as Source }))
    .sort(
      (a, b) =>
        a.source.author.localeCompare(b.source.author) ||
        a.source.year.localeCompare(b.source.year) ||
        a.source.title.localeCompare(b.source.title),
    );

  const counts = new Map<string, number>();
  for (const { source } of sources) {
    const group = `${source.author}|${source.year}`;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const resolved = {} as Record<K, Reference>;
  const list: Reference[] = [];
  for (const { key, source } of sources) {
    const group = `${source.author}|${source.year}`;
    const index = seen.get(group) ?? 0;
    seen.set(group, index + 1);
    const letter = (counts.get(group) ?? 0) > 1 ? String.fromCharCode(97 + index) : "";
    const shownYear = `${source.year}${letter}`;
    const reference: Reference = {
      ...source,
      shownYear,
      cite: source.cite ?? `${source.short ?? source.author}, ${shownYear}`,
    };
    resolved[key] = reference;
    list.push(reference);
  }
  return Object.assign(resolved, { list });
}

export const REFERENCES = {
  hiqaFramework: ref({
    id: "ref-hiqa-framework",
    short: "HIQA",
    author: "Health Information and Quality Authority",
    year: "2025",
    title: "Assessment-judgment framework for designated centres for older people",
    detail: "Version 4.1. Dublin: HIQA.",
    url: "https://hiqa.ie/sites/default/files/2025-03/AJF-DCOP-Guidance.pdf",
  }),
  hiqaStandards: ref({
    id: "ref-hiqa-standards",
    short: "HIQA",
    author: "Health Information and Quality Authority",
    year: "2016",
    title: "National Standards for Residential Care Settings for Older People in Ireland",
    detail: "Dublin: HIQA.",
    url: "https://www.hiqa.ie/reports-and-publications/standard/national-standards-residential-care-settings-older-people-ireland",
  }),
  careRegulations: ref({
    id: "ref-care-regulations",
    cite: "S.I. No. 415 of 2013",
    author: "Government of Ireland",
    year: "2013",
    title: "Health Act 2007 (Care and Welfare of Residents in Designated Centres for Older People) Regulations 2013",
    detail: "S.I. No. 415 of 2013. Dublin: Stationery Office.",
    url: "https://www.irishstatutebook.ie/eli/2013/si/415/made/en/print",
  }),
  // The 2025 amendment, which changed some of the numbers the 2013 text as made gives, such as the
  // notice periods in Regulations 31 and 32 (CCARE-306). Made 27 March 2025, in operation from
  // 31 March 2025. Its title and number were confirmed in a web search of the Statute Book's index;
  // the page itself refuses automated requests, so check the link by hand.
  careRegulations2025: ref({
    id: "ref-care-regulations-2025",
    cite: "S.I. No. 98 of 2025",
    author: "Government of Ireland",
    year: "2025",
    title: "Health Act 2007 (Care and Welfare of Residents in Designated Centres for Older People) (Amendment) Regulations 2025",
    detail: "S.I. No. 98 of 2025. Dublin: Stationery Office.",
    url: "https://www.irishstatutebook.ie/eli/2025/si/98/made/en/print",
  }),
  hseNhss: ref({
    id: "ref-hse-nhss",
    short: "HSE",
    author: "Health Service Executive",
    year: "n.d.",
    title: "Nursing Homes Support Scheme (Fair Deal)",
    detail: "Web page. Dublin: HSE.",
    url: "https://www.hse.ie/nhss/",
  }),
  hseApplicationForm: ref({
    id: "ref-hse-application-form",
    short: "HSE",
    author: "Health Service Executive",
    // "Version 5, October 2026" on its cover, checked 23 Nov 2026.
    year: "2026",
    title: "Nursing Homes Support Scheme: Application form and support information",
    detail: "Version 5, October 2026. Dublin: HSE.",
    url: "https://www2.hse.ie/documents/5252/The_Nursing_Homes_Support_Scheme_Application_form_and_support_information.pdf",
  }),
  hseFinancialAssessment: ref({
    id: "ref-hse-financial-assessment",
    short: "HSE",
    author: "Health Service Executive",
    year: "n.d.",
    title: "Fair Deal scheme: Financial assessment",
    detail: "Web page. Dublin: HSE.",
    url: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/financial-assessment/",
  }),
  hseThreeYearCap: ref({
    id: "ref-hse-three-year-cap",
    short: "HSE",
    author: "Health Service Executive",
    year: "n.d.",
    title: "Fair Deal scheme: 3-year cap",
    detail: "Web page. Dublin: HSE.",
    url: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/3-year-cap/",
  }),
  hseNursingHomeLoan: ref({
    id: "ref-hse-nursing-home-loan",
    short: "HSE",
    author: "Health Service Executive",
    year: "n.d.",
    title: "Fair Deal scheme: Nursing home loan",
    detail: "Web page. Dublin: HSE.",
    url: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/nursing-home-loan/",
  }),
  hseCareNeeds: ref({
    id: "ref-hse-care-needs",
    short: "HSE",
    author: "Health Service Executive",
    year: "n.d.",
    title: "Fair Deal scheme: Care needs assessment",
    detail: "Web page. Dublin: HSE.",
    url: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/care-needs-assessment/",
  }),
  hseFindingAHome: ref({
    id: "ref-hse-finding-a-home",
    short: "HSE",
    author: "Health Service Executive",
    year: "n.d.",
    title: "Fair Deal scheme: Finding the right nursing home",
    detail: "Web page. Dublin: HSE.",
    url: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/finding-the-right-nursing-home/",
  }),
  cagSpecialReport110: ref({
    id: "ref-cag-special-report-110",
    short: "Comptroller and Auditor General",
    author: "Comptroller and Auditor General",
    // "Report number 110, May 2020" on its cover; the Comptroller signed it on 8 May 2020.
    year: "2020",
    title: "Special Report 110: The Nursing Homes Support Scheme (Fair Deal)",
    detail: "Report number 110, May 2020. Dublin: Office of the Comptroller and Auditor General.",
    url: "https://www.audit.gov.ie/media/u4kaxxwq/special-report-110-the-nursing-homes-support-scheme-fair-deal-_.pdf",
  }),
  dailWrittenAnswer2024: ref({
    id: "ref-dail-written-answer-2024",
    short: "Dáil Éireann",
    author: "Dáil Éireann",
    year: "2024",
    title: "Written answer, 5 November 2024",
    detail: "Dáil debates. Dublin: Houses of the Oireachtas.",
    url: "https://www.oireachtas.ie/en/debates/question/2024-11-05/1069/",
  }),
  budget2026: ref({
    id: "ref-budget-2026",
    short: "Department of Social Protection",
    author: "Department of Social Protection",
    year: "2025",
    title: "Budget 2026",
    // Published for Budget day, 7 October 2025.
    detail: "Web page, published for Budget day, October 2025. Dublin: Government of Ireland.",
    url: "https://www.gov.ie/en/department-of-social-protection/publications/budget-2026/",
  }),
  budget2027: ref({
    id: "ref-budget-2027",
    short: "Department of Social Protection",
    author: "Department of Social Protection",
    year: "2026",
    title: "Budget 2027",
    // Published for Budget day, October 2026.
    detail: "Web page, published for Budget day, October 2026. Dublin: Government of Ireland.",
    url: "https://www.gov.ie/en/department-of-social-protection/publications/budget-2027/",
  }),
  nhiChargesGuide: ref({
    id: "ref-nhi-charges-guide",
    short: "Nursing Homes Ireland",
    author: "Nursing Homes Ireland",
    year: "2019",
    title: "Guide to Nursing Home Charges for Fair Deal/NHSS Residents",
    detail: "PDF. Dublin: Nursing Homes Ireland.",
    url: "https://nhi.ie/wp-content/uploads/2022/03/Guide-to-Nursing-Home-Charges-for-Fair-Deal-NHSS-Residents-21.11.19.pdf",
  }),
  ciPublicHealthServices: ref({
    id: "ref-ci-public-health-services",
    short: "Citizens Information",
    author: "Citizens Information",
    year: "n.d.",
    title: "Entitlement to public health services",
    detail: "Web page. Dublin: Citizens Information Board.",
    url: "https://www.citizensinformation.ie/en/health/health-system/entitlement-to-public-health-services/",
  }),
  dssBecomingRepresentative: ref({
    id: "ref-dss-becoming-representative",
    short: "Decision Support Service",
    author: "Decision Support Service",
    year: "n.d.",
    title: "Becoming a decision-making representative",
    detail: "Web page. Dublin: Decision Support Service.",
    url: "https://www.decisionsupportservice.ie/services/decision-making-representation-order/becoming-decision-making-representative",
  }),
  dssHome: ref({
    id: "ref-dss-home",
    short: "Decision Support Service",
    author: "Decision Support Service",
    year: "n.d.",
    title: "Decision Support Service",
    detail: "Web site. Dublin: Decision Support Service.",
    url: "https://www.decisionsupportservice.ie",
  }),
  hiqaRegister: ref({
    id: "ref-hiqa-register",
    short: "HIQA",
    author: "Health Information and Quality Authority",
    year: "n.d.",
    // Described rather than titled: the link is the register's CSV export, which the pipeline
    // downloads every day (ADR-0014), so it is known to work.
    title: "Register of designated centres for older people",
    detail: "Data set (CSV), updated by HIQA as registrations change. Dublin: HIQA.",
    url: "https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv",
  }),
  ccpcMovingIn: ref({
    id: "ref-ccpc-moving-in",
    short: "CCPC",
    author: "Competition and Consumer Protection Commission",
    year: "n.d.",
    title: "Moving into a nursing home",
    detail: "Web page. Dublin: CCPC.",
    url: "https://www.ccpc.ie/manage-your-money/planning-for-the-future/how-to-plan-for-the-future/moving-into-a-nursing-home",
  }),
} as const;
