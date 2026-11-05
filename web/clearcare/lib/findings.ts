// lib/findings.ts
// What the inspectors found and what providers promised, from GET /centres/{centre_id}/findings
// (CentreFindingsResult in api/openapi.yaml, CCARE-206), turned into the centre page's highlights
// and promise trails (CCARE-207). Every quote is the report's own words: the rules below only
// choose which findings come first. No runtime imports, so the tests can load it as it is.
import type { CentreReports, Highlight, Inspection, ISODate, Judgement, PromiseTrail, Regulation, SourceRef } from "./centres";

// A passage of a report, verbatim, with the PDF pages it spans (cover included).
export interface ReportText {
  text: string;
  first_page: number;
  last_page: number;
}

// A commitment in the provider's response with the deadline it states. A span can combine
// actions or carry context (ADR-0017), so it is shown as written, not as one tidy promise.
export interface StatedDeadline {
  text: string;
  stated_deadline: ISODate;
  stated_deadline_text: string;
  deadline_precision: "day" | "month";
  page: number;
  last_page: number;
}

export type ReAssessmentStatus = "re-assessed" | "not re-assessed" | "no later report" | "order unknown";

// When the regulation was next judged (ADR-0024). Everything but status is null unless it was
// re-assessed. Any later judgment counts, not only Compliant.
export interface ReAssessment {
  status: ReAssessmentStatus;
  report_id: number | null;
  inspection_date: ISODate | null;
  report_url: string | null;
  judgment: string | null;
  reports_between: number | null;
  inspector: ReportText | null;
}

export interface Finding {
  report_id: number;
  inspection_date: ISODate | null;
  report_url: string;
  regulation: string; // "Regulation 28"
  title: string;
  judgment: string; // as printed, in any case
  compliance_items: { regulation: string; risk_rating: string | null; date_to_comply: ISODate | null }[];
  inspector: ReportText | null;
  provider_response: ReportText | null;
  stated_deadlines: StatedDeadline[] | null; // null when there's no response or it wasn't split
  re_assessment: ReAssessment;
}

export interface CentreFindingsResult {
  centre_id: string;
  findings: Finding[];
}

type Judged = Exclude<Judgement, "not-assessed">;

// The reports print judgments in either case ("Not compliant", "Not Compliant"). Anything else
// is not one of HIQA's three.
export function toJudgement(judgment: string): Judged | undefined {
  switch (judgment.trim().toLowerCase().replace(/\s+/g, " ")) {
    case "compliant":
      return "compliant";
    case "substantially compliant":
      return "substantially-compliant";
    case "not compliant":
      return "not-compliant";
  }
}

const RANK: Record<Judgement, number> = { "not-assessed": -1, compliant: 0, "substantially-compliant": 1, "not-compliant": 2 };
const RULE_ORDER: Highlight["rule"][] = ["not-compliant-latest", "repeated", "promise-not-rejudged"];

// --- The report text -------------------------------------------------------------------------

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Words that may wrap onto a new line in the PDF.
const words = (text: string) => text.trim().split(/\s+/).map(escape).join("\\s+");
const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

// The heading the extractor starts each passage with, "Regulation 28: Fire precautions". The
// report's own heading can word the title differently from Appendix 1, so failing that, the
// first line goes if it is a regulation heading.
function withoutHeading(text: string, regulation: string, title: string) {
  const exact = new RegExp(`^\\s*${words(regulation)}\\s*:\\s*${words(title)}`, "i");
  if (exact.test(text)) return text.replace(exact, "");
  return text.replace(/^\s*Regulation\s+\d+\s*:[^\n]*/i, "");
}

// The bullets the reports use: Word's Symbol and Wingdings bullets as extracted (U+F0B7, U+F0D8),
// "•", "·", and a provider's "- ".
const BULLET = /^\s*[•·▪●-]\s+/;
// The prefix a list item's paragraph carries, for the page to show it as a list.
export const LIST_ITEM = "• ";

// The extracted text keeps the PDF's line breaks and has no blank lines, so paragraphs are
// rebuilt: a bullet starts a list item, and a line that ends a sentence well short of the
// passage's full width ends its paragraph. A word hyphenated across lines is joined again.
function paragraphs(body: string): string[] {
  const lines = body
    // Two items can share a PDF line; the glyphs here are never ordinary punctuation.
    .replace(/\s+([•])\s+/g, "\n$1 ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const width = Math.max(0, ...lines.map((line) => line.length));
  const result: string[] = [];
  let current = "";
  let item = false;
  let previous = "";
  const flush = () => {
    const text = collapse(current);
    if (text) result.push(item ? `${LIST_ITEM}${text}` : text);
    current = "";
  };
  for (const line of lines) {
    const bullet = line.match(BULLET);
    if (bullet) {
      flush();
      item = true;
      current = line.slice(bullet[0].length);
    } else if (current && /[.:;!?]["”’)]?$/.test(previous) && previous.length < width * 0.75) {
      flush();
      item = false;
      current = line;
    } else if (/[A-Za-z]-$/.test(current) && /^[a-z]/.test(line)) {
      current += line;
    } else {
      current = current ? `${current} ${line}` : line;
    }
    previous = line;
  }
  flush();
  return result;
}

// One stretch of text on its own, such as a commitment: no bullet, no line breaks.
export const plain = (text: string) => collapse(text.replace(BULLET, "")).replace(/([A-Za-z])- (?=[a-z])/g, "$1-");

// The paragraphs of a passage, without the parts the page already says: the heading and the
// inspector's "Judgment:" line, or the judgment and form wording at the top of a response.
// List items start with LIST_ITEM.
export function passage(text: string, regulation: string, title: string, kind: "inspector" | "response"): string[] {
  let body = withoutHeading(text, regulation, title);
  if (kind === "inspector") {
    body = body.replace(/\s*Judge?ment\s*:\s*(?:Not compliant|Substantially compliant|Compliant)\s*$/i, "");
  } else {
    body = body
      .replace(/^\s*(?:Not|Substantially)?\s*Compliant\b/i, "")
      .replace(/^\s*Outline how you are going to come into compliance with\s+Regulation\s+\d+\s*:[^:]*:/i, "");
  }
  return paragraphs(body);
}

// The opening of a passage for the short list: whole sentences up to about 240 characters, with
// an ellipsis where it stops early.
export function excerpt(paragraphs: string[], limit = 240): string {
  const text = paragraphs.map((paragraph) => paragraph.replace(LIST_ITEM, "")).join(" ");
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z“"(])/);
  let kept = sentences[0];
  if (kept.length > limit + 80) {
    kept = kept.slice(0, limit).replace(/\s+\S*$/, "");
  } else {
    for (const sentence of sentences.slice(1)) {
      if (kept.length + 1 + sentence.length > limit) break;
      kept += ` ${sentence}`;
    }
  }
  // After a whole sentence the ellipsis gets a space, so it doesn't run into the full stop.
  const more = kept.length < text.length ? (/[.!?]$/.test(kept) ? " …" : "…") : "";
  return `“${kept}${more}”`;
}

const pages = (first: number, last: number) => (first === last ? `p. ${first}` : `pp. ${first}–${last}`);
// The report opens at the page in most browsers' PDF viewers.
const pageUrl = (url: string, page: number) => `${url}#page=${page}`;

function source(document: SourceRef["document"], url: string, first: number, last: number, context?: string): SourceRef {
  return { document, page: first, ...(last > first && { lastPage: last }), ...(context && { context }), url: pageUrl(url, first) };
}

// --- Highlights and trails -------------------------------------------------------------------

const regulationNumber = (regulation: string) => Number(regulation.match(/\d+/)?.[0]) || undefined;

// Adds the highlights and promise trails to what the reports already say. Only findings of
// reports on the timeline are used, so every date and link on the page agrees.
export function addFindings(reports: CentreReports, findings: Finding[] | null): CentreReports {
  if (!findings?.length) return reports;
  const { inspections, history } = reports;
  const position = new Map(inspections.map((inspection, index) => [inspection.id, index]));

  // Each regulation's findings, newest inspection first.
  const byRegulation = new Map<number, Finding[]>();
  for (const finding of findings) {
    const number = regulationNumber(finding.regulation);
    if (!number || !position.has(String(finding.report_id)) || !toJudgement(finding.judgment)) continue;
    byRegulation.set(number, [...(byRegulation.get(number) ?? []), finding]);
  }
  for (const list of byRegulation.values()) {
    list.sort((a, b) => position.get(String(b.report_id))! - position.get(String(a.report_id))!);
  }

  const judged = inspections.filter((inspection) => inspection.regulationJudgements);
  const latestJudged = judged.at(-1);
  const highlights: Highlight[] = [];
  const trails: PromiseTrail[] = [];

  for (const [number, list] of byRegulation) {
    const row = history.find((candidate) => candidate.regulation.number === number);
    // The same title as the history table, where the regulation is in it.
    const regulation: Regulation = row?.regulation ?? { number, title: list[0].title };
    const atInspection = (inspection: Inspection) => list.find((finding) => String(finding.report_id) === inspection.id);

    // Not fully compliant at each of the last inspections that judged regulations, up to the latest.
    const run: Inspection[] = [];
    for (const inspection of [...judged].reverse()) {
      const result = row?.results[inspection.id];
      if (!result || result === "compliant") break;
      run.unshift(inspection);
    }

    const newest = list[0];
    let chosen: { highlight: Highlight; traced: Finding } | undefined;
    if (run.length >= 2) {
      const latest = atInspection(run.at(-1)!) ?? newest;
      // The trail follows the finding before, so it shows what was promised and what the latest
      // inspection then found.
      chosen = {
        highlight: inspectorHighlight("repeated", latest, regulation, run.map((inspection) => inspection.date)),
        traced: atInspection(run.at(-2)!) ?? latest,
      };
    } else if (latestJudged && String(newest.report_id) === latestJudged.id && toJudgement(newest.judgment) === "not-compliant") {
      chosen = { highlight: inspectorHighlight("not-compliant-latest", newest, regulation, [latestJudged.date]), traced: newest };
    } else {
      chosen = promiseNotRejudged(list, regulation, inspections);
    }
    if (!chosen) continue;

    highlights.push(chosen.highlight);
    const trail = toTrail(chosen.traced, regulation, inspections);
    if (trail) trails.push(trail);
  }

  // Worst first, then by rule, then by regulation number.
  highlights.sort(
    (a, b) =>
      RANK[b.judgement] - RANK[a.judgement] ||
      RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule) ||
      a.regulation.number - b.regulation.number,
  );
  const order = new Map(highlights.map((highlight, index) => [highlight.regulation.number, index]));
  trails.sort((a, b) => order.get(a.regulation.number)! - order.get(b.regulation.number)!);

  return { ...reports, highlights, trails };
}

function inspectorHighlight(rule: Highlight["rule"], finding: Finding, regulation: Regulation, dates: ISODate[]): Highlight {
  const judgement = toJudgement(finding.judgment)!;
  const text = finding.inspector && passage(finding.inspector.text, finding.regulation, finding.title, "inspector");
  if (!finding.inspector || !text?.length) {
    return { rule, judgement, dates, regulation, text: "Read what the inspector wrote in the report.", sources: [], reportUrl: finding.report_url };
  }
  const { first_page, last_page } = finding.inspector;
  return {
    rule,
    judgement,
    dates,
    regulation,
    text: excerpt(text),
    sources: [`Inspector · report ${pages(first_page, last_page)}`],
    reportUrl: pageUrl(finding.report_url, first_page),
  };
}

// The provider stated a deadline that had passed by a later inspection, and no later inspection
// judged the regulation, so nobody has said whether it was done.
function promiseNotRejudged(list: Finding[], regulation: Regulation, inspections: Inspection[]) {
  const latest = inspections.at(-1)!;
  for (const finding of list) {
    if (finding.re_assessment.status !== "not re-assessed") continue;
    const deadline = finding.stated_deadlines?.find((candidate) => candidate.stated_deadline < latest.date);
    if (!deadline || !finding.inspection_date) continue;
    const highlight: Highlight = {
      rule: "promise-not-rejudged",
      judgement: "not-assessed",
      dates: [finding.inspection_date, latest.date],
      regulation,
      text: `“${plain(deadline.text)}”`,
      sources: [`Provider · plan ${pages(deadline.page, deadline.last_page)}`],
      reportUrl: pageUrl(finding.report_url, deadline.page),
    };
    return { highlight, traced: finding };
  }
}

// The trail of one finding: what the inspector found, what the provider said they would do, and
// when the regulation was next judged. None without the inspector's words to start from.
export function toTrail(finding: Finding, regulation: Regulation, inspections: Inspection[]): PromiseTrail | null {
  const quotes = finding.inspector && passage(finding.inspector.text, finding.regulation, finding.title, "inspector");
  if (!finding.inspector || !quotes?.length) return null;

  const risks = [...new Set(finding.compliance_items.map((item) => item.risk_rating?.trim().toLowerCase()).filter(Boolean))];
  const datesToComply = [...new Set(finding.compliance_items.map((item) => item.date_to_comply).filter((date) => date !== null))];
  const promises = (finding.stated_deadlines ?? []).map((deadline, index) => ({
    label: String.fromCharCode(65 + index), // "A", "B"…
    quote: plain(deadline.text),
    due: deadline.stated_deadline_text,
    source: source("plan", finding.report_url, deadline.page, deadline.last_page),
  }));
  // The whole response stands in when no commitment in it states a deadline.
  const responseText =
    promises.length === 0 && finding.provider_response
      ? passage(finding.provider_response.text, finding.regulation, finding.title, "response")
      : [];

  return {
    regulation,
    finding: {
      inspectionId: String(finding.report_id),
      judgement: toJudgement(finding.judgment)!,
      ...(risks.length > 0 && { risk: risks.join(" and ") }),
      quotes,
      source: source("report", finding.report_url, finding.inspector.first_page, finding.inspector.last_page, "Inspector"),
    },
    promises,
    ...(responseText.length > 0 && {
      response: {
        quotes: responseText,
        source: source("plan", finding.report_url, finding.provider_response!.first_page, finding.provider_response!.last_page, "Provider"),
      },
    }),
    ...(datesToComply.length > 0 && { datesToComply }),
    ...followUp(finding, inspections),
  };
}

function followUp(finding: Finding, inspections: Inspection[]): Pick<PromiseTrail, "followUp" | "orderUnknown"> {
  const reAssessment = finding.re_assessment;
  switch (reAssessment.status) {
    case "re-assessed": {
      const judgement = toJudgement(reAssessment.judgment ?? "");
      const quotes =
        reAssessment.inspector && passage(reAssessment.inspector.text, finding.regulation, finding.title, "inspector");
      return {
        followUp: {
          inspectionId: String(reAssessment.report_id),
          date: reAssessment.inspection_date ?? undefined,
          judgement: judgement ?? "not-assessed",
          ...(!judgement && reAssessment.judgment && { printedJudgement: reAssessment.judgment }),
          ...(reAssessment.inspector &&
            quotes?.length && {
              quotes,
              source: source(
                "report",
                reAssessment.report_url ?? finding.report_url,
                reAssessment.inspector.first_page,
                reAssessment.inspector.last_page,
                "Inspector",
              ),
            }),
          ...(reAssessment.reports_between ? { between: reAssessment.reports_between } : {}),
          updates: [],
        },
      };
    }
    case "not re-assessed": {
      const index = inspections.findIndex((inspection) => inspection.id === String(finding.report_id));
      const later = inspections.slice(index + 1);
      if (later.length === 0) return {};
      return {
        followUp: {
          inspectionId: later[0].id,
          judgement: "not-assessed",
          ...(later.length > 1 && { notAssessedSince: later.length - 1 }),
          updates: [],
        },
      };
    }
    case "order unknown":
      return { orderUnknown: true };
    default:
      return {};
  }
}
