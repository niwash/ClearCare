// lib/sample-reports.ts
// Elm Hall's reports, from the wireframe. Used until the API serves reports; delete then.
import type { CentreReports } from "./centres";

export const SAMPLE_REPORTS_CENTRE_ID = "34";

const FIRE = { number: 28, title: "Fire precautions" };
const CARE_PLAN = { number: 5, title: "Individual assessment and care plan" };
const DIRECTORY = { number: 19, title: "Directory of residents" };

export const SAMPLE_REPORTS: CentreReports = {
  inspections: [
    { id: "2024-03", date: "2024-03-05", type: "Unannounced", publishedDate: "2024-05-23", reportUrl: "#", regulationJudgements: true },
    {
      id: "2024-08",
      date: "2024-08-29",
      type: "Thematic",
      publishedDate: "2024-11-05",
      reportUrl: "#",
      regulationJudgements: false,
      summary: "Thematic inspection on restrictive practice. Judged against the National Standards, so no regulation judgments.",
    },
    { id: "2025-06", date: "2025-06-25", type: "Unannounced", publishedDate: "2025-09-25", reportUrl: "#", regulationJudgements: true },
    { id: "2026-04", date: "2026-04-10", type: "Unannounced", publishedDate: "2026-08-27", reportUrl: "#", regulationJudgements: true },
  ],
  history: [
    { regulation: FIRE, results: { "2025-06": "substantially-compliant" } },
    { regulation: CARE_PLAN, results: { "2025-06": "substantially-compliant", "2026-04": "substantially-compliant" } },
    { regulation: DIRECTORY, results: { "2026-04": "not-compliant" } },
    {
      regulation: { number: 23, title: "Governance and management" },
      results: { "2024-03": "compliant", "2025-06": "compliant", "2026-04": "substantially-compliant" },
    },
    { regulation: { number: 8, title: "Protection" }, results: { "2025-06": "compliant", "2026-04": "compliant" } },
    { regulation: { number: 27, title: "Infection control" }, results: { "2025-06": "compliant" } },
    { regulation: { number: 15, title: "Staffing" }, results: { "2024-03": "compliant" } },
    { regulation: { number: 4, title: "Written policies and procedures" }, results: { "2024-03": "compliant", "2026-04": "compliant" } },
    { regulation: { number: 9, title: "Residents' rights" }, results: { "2024-03": "compliant", "2025-06": "compliant" } },
    { regulation: { number: 17, title: "Premises" }, results: { "2024-03": "substantially-compliant", "2025-06": "compliant" } },
  ],
  highlights: [
    {
      rule: "not-compliant-latest",
      judgement: "not-compliant",
      dates: ["2026-04-10"],
      regulation: DIRECTORY,
      text: "“…a directory of residents in paper or electronic format was not available when repeatedly requested on the day of inspection.”",
      sources: ["Report p. 7", "Follow-up: next inspection"],
      reportUrl: "#",
    },
    {
      rule: "repeated",
      judgement: "substantially-compliant",
      dates: ["2025-06-25", "2026-04-10"],
      regulation: CARE_PLAN,
      text: "Substantially compliant both times. June 2025: “Safeguarding plans were seen to be generic and did not provide sufficient guidance in respect of the specific interventions required to safeguard the residents.”",
      sources: ["Reports p. 10 and p. 9"],
      reportUrl: "#",
    },
    {
      rule: "promise-not-rejudged",
      judgement: "not-assessed",
      dates: ["2025-06-25", "2026-04-10"],
      regulation: FIRE,
      text: "Two promises after June 2025. The April 2026 inspection did not assess Regulation 28. In its narrative, the inspector reported one promise done and one on schedule.",
      sources: ["Plan p. 15 · Report p. 5"],
    },
  ],
  visitQuestions: [
    "Whether the laundry has moved away from the bedroom corridor, as planned for the second quarter of 2026.",
    "What changed about the directory of residents after the April 2026 inspection.",
    "How safeguarding and care plans are reviewed now. Regulation 5 came up in June 2025 and in April 2026.",
  ],
  trails: [
    {
      regulation: FIRE,
      finding: {
        inspectionId: "2025-06",
        judgement: "substantially-compliant",
        risk: "yellow (low)",
        quotes: [
          "The laundry facility was opening on to a bedroom corridor and on a protected escape route.",
          "Some of the fire doors did not meet the required standards to ensure appropriate protection in the event of fire.",
        ],
        source: { document: "report", page: 10, context: "Inspector", url: "#" },
      },
      promises: [
        {
          label: "A",
          title: "Fire doors",
          quote: "…planned completion of works scheduled for week ending 25th July 2025.",
          due: "25 Jul 2025",
          source: { document: "plan", page: 15 },
        },
        {
          label: "B",
          title: "Laundry",
          quote:
            "…commence the relocation of the existing laundry area in Quarter 2 2026. In the meantime, a risk assessment has been undertaken…",
          due: "Q2 2026",
          source: { document: "plan", page: 15 },
        },
      ],
      planNote: "The plan's own table (p. 17) gives 30 Jun 2025 as the date to comply. Both dates are shown as written.",
      followUp: {
        inspectionId: "2026-04",
        judgement: "not-assessed",
        updates: [
          {
            promiseLabel: "A",
            status: "done",
            quote: "…in line with the providers’ compliance plan, fire door replacement and remedial works had been completed.",
            source: { document: "report", page: 5, context: "narrative" },
          },
          {
            promiseLabel: "B",
            status: "in-progress",
            quote: "…the inspector was informed that the plans to relocate this service are on schedule.",
            source: { document: "report", page: 5, context: "narrative" },
          },
        ],
      },
    },
  ],
};
