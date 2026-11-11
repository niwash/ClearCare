// components/centre/finding-bits.tsx
// Small pieces What to look at first and What happened next share (CCARE-212): a judgement as a
// coloured chip, what became of a finding in a word or two, and where a passage is in the report.
// Written for families rather than inspectors: plain words, with the judgement's own label kept so
// it matches the report and the history table.
import { formatDate, formatSource, type Inspection, type Judgement, type PromiseTrail, type SourceRef } from "@/lib/centres";
import { LIST_ITEM } from "@/lib/findings";
import { JUDGEMENT_LABELS, JudgementIcon } from "./judgement-icon";

const CHIP_TONES: Record<Judgement, string> = {
  "not-compliant": "bg-tint-rose text-on-tint-rose",
  "substantially-compliant": "bg-tint-gold text-on-tint-gold",
  compliant: "bg-tint-sage text-on-tint-sage",
  "not-assessed": "bg-surface-muted text-ink-muted",
};

// The judgement as a chip: its icon, so it doesn't rest on colour alone, and its label.
export function JudgementChip({ judgement }: { judgement: Judgement }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold adult:rounded-md adult:border adult:border-line ${CHIP_TONES[judgement]}`}
    >
      <JudgementIcon judgement={judgement} size={13} />
      {JUDGEMENT_LABELS[judgement]}
    </span>
  );
}

// HIQA's risk rating for an item of a compliance plan, which it gives as a colour: what each colour
// means in words, with a dot in that colour. The colour's name isn't repeated, as the words say it.
const RISKS: Record<string, { label: string; dot: string }> = {
  red: { label: "High risk", dot: "bg-[#c0392b]" },
  orange: { label: "Moderate risk", dot: "bg-[#e67e22]" },
  yellow: { label: "Low risk", dot: "bg-[#e6b800]" },
};

// risk may be several, "orange and yellow", when the plan's items were rated differently.
export function RiskRating({ risk }: { risk: string }) {
  const ratings = [...new Set(risk.split(/\s+and\s+/).map((rating) => rating.trim().toLowerCase()))];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
      <span className="text-ink-muted">HIQA rating:</span>
      {ratings.map((rating) => {
        const known = RISKS[rating];
        return (
          <span key={rating} className="inline-flex items-center gap-1.5 font-semibold">
            {known && <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${known.dot}`} />}
            {known?.label ?? rating}
          </span>
        );
      })}
    </span>
  );
}

// kind: how the story ended, which the question to ask goes by (askTheHome) whatever the label says.
export type Outcome = {
  label: string;
  tone: "bad" | "open";
  kind: "not-compliant" | "substantially-compliant" | "to-check" | "not-checked" | "other";
};

const OUTCOME_TONES: Record<Outcome["tone"], string> = {
  bad: "bg-tint-rose text-on-tint-rose",
  open: "bg-tint-gold text-on-tint-gold",
};

// What became of a finding, in a word or two: how the regulation was judged when an inspection next
// judged it, or that it isn't known yet. The label says what the inspection judged and no more. A
// second judgment against the same regulation can be about a different problem from the first, so
// it doesn't show that the first was left unfixed, or partly fixed (#170 review).
// Never compliant: addFindings (lib/findings.ts) traces only findings that were still a problem, so
// the next inspection that judged one found it not compliant or substantially compliant.
// The next inspection is due to check a compliance plan, but nobody knows when it will be, so the
// label says what it will do rather than that it is coming.
export function trailOutcome({ finding, followUp, orderUnknown }: PromiseTrail): Outcome {
  if (!followUp) {
    return orderUnknown
      ? { label: "Not clear yet", tone: "open", kind: "other" }
      : { label: "To be checked at next inspection", tone: "open", kind: "to-check" };
  }
  if (followUp.printedJudgement) return { label: `Judged “${followUp.printedJudgement}”`, tone: "open", kind: "other" };
  switch (followUp.judgement) {
    case "not-assessed":
      return { label: "Not checked since", tone: "open", kind: "not-checked" };
    case "substantially-compliant":
      return { label: "Substantially compliant", tone: "open", kind: "substantially-compliant" };
    default:
      // "again" only when it was not compliant the first time too.
      return { label: finding.judgement === "not-compliant" ? "Not compliant again" : "Not compliant", tone: "bad", kind: "not-compliant" };
  }
}

export function OutcomePill({ outcome }: { outcome: Outcome }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-sm font-semibold adult:rounded-md adult:border adult:border-line ${OUTCOME_TONES[outcome.tone]}`}>
      {outcome.label}
    </span>
  );
}

// Where a passage is: "Inspector · report p. 12", and a link that opens the report at that page
// when there is one (the source's own, or href for a highlight, whose source is only words).
export function SourceLink({ source, href }: { source: SourceRef | string; href?: string }) {
  const text = typeof source === "string" ? source : formatSource(source);
  const url = href ?? (typeof source === "string" ? undefined : source.url);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-small text-ink-muted">
      <PageIcon />
      {text}
      {/* A link can't be followed on paper, where the page number above says where to look. */}
      {url && (
        <span className="contents print:hidden">
          <span aria-hidden>·</span>
          <a href={url} className="font-semibold tap-target">
            Open the page
          </a>
        </span>
      )}
    </p>
  );
}

function PageIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M7 3h7l5 5v13H7zM14 3v5h5" />
    </svg>
  );
}

// An inspection's date, from the timeline, or the one given when the report isn't on it.
export function inspectionDate(inspections: Inspection[], id: string, fallback?: string) {
  const date = inspections.find((candidate) => candidate.id === id)?.date ?? fallback;
  return date ? formatDate(date) : undefined;
}

// The report's own words: its paragraphs, with each run of list items as a list.
// bare: without its own left line, for inside a quote that already has one.
export function Quotes({ quotes, bare = false }: { quotes: string[]; bare?: boolean }) {
  const blocks: (string | string[])[] = [];
  for (const quote of quotes) {
    if (!quote.startsWith(LIST_ITEM)) blocks.push(quote);
    else if (Array.isArray(blocks.at(-1))) (blocks.at(-1) as string[]).push(quote.slice(LIST_ITEM.length));
    else blocks.push([quote.slice(LIST_ITEM.length)]);
  }
  return (
    <blockquote className={`flex max-w-3xl flex-col gap-3 leading-relaxed text-ink ${bare ? "" : "border-l-2 border-line pl-4"}`}>
      {blocks.map((block, index) =>
        typeof block === "string" ? (
          <p key={index}>{block}</p>
        ) : (
          <ul key={index} className="flex list-disc flex-col gap-2 pl-5">
            {block.map((item, itemIndex) => (
              <li key={itemIndex}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </blockquote>
  );
}

// What to ask the home, by how the story ended (What happened next, and What to ask). The reports stop
// at the last inspection, so only the home can say what has happened since.
// several: the question asked once about more than one topic (What to ask), so "this" is "these".
export function askTheHome({ kind }: Pick<Outcome, "kind">, findingDate?: string, several = false) {
  if (kind === "not-compliant")
    return several
      ? "“What are you doing about these now, and when will they be fixed?”"
      : "“What are you doing about this now, and when will it be fixed?”";
  if (kind === "substantially-compliant")
    return several ? "“What is left to do on these, and when will it be done?”" : "“What is left to do on this, and when will it be done?”";
  if (kind === "to-check") return `“What has changed since the inspection${findingDate ? ` in ${findingDate.replace(/^\d+ /, "")}` : ""}?”`;
  if (kind === "not-checked")
    return several ? "“Were these put right? No inspection has checked since.”" : "“Was this put right? No inspection has checked since.”";
  return several ? "“What has happened with these since the last inspection?”" : "“What has happened with this since the last inspection?”";
}
