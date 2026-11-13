// components/centre/extra-conditions.tsx
// The extra conditions on a home's registration as it stands, and the Chief Inspector's note on it
// when there is one (CCARE-235), at the top of the overview: a family should know of them before
// anything else on the page. They are HIQA's words, quoted with the condition's number and never
// summarised or given a label of ours. A home with neither has no box.
import { formatDate, type ExtraCondition } from "@/lib/centres";
import { ClampedWords, WordsToggle, wordsGroupClass } from "./register-words";
import { sectionCardClass } from "./section-icon";

type ExtraConditionsProps = {
  conditions: ExtraCondition[];
  note: string | null;
  // When the register they are from was downloaded (ISO date-time).
  registerDate: string;
};

export function ExtraConditions({ conditions, note, registerDate }: ExtraConditionsProps) {
  if (conditions.length === 0 && !note) return null;
  const count = conditions.length;

  return (
    <section aria-labelledby="conditions-h" className={`${wordsGroupClass} ${sectionCardClass} flex flex-col gap-4 p-4 md:p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="conditions-h" className="font-heading text-xl font-semibold">
          {count > 0
            ? `${count} extra ${count === 1 ? "condition" : "conditions"} on this home’s registration`
            : "Chief Inspector’s note on this home’s registration"}
        </h2>
        <p className="text-small text-ink-muted">
          HIQA&apos;s register, <time dateTime={registerDate}>{formatDate(registerDate)}</time>
        </p>
      </div>

      {count > 0 && (
        <div>
          <ol className="flex flex-col gap-3">
            {conditions.map((condition) => (
              <li key={condition.number} className="flex flex-col gap-0.5">
                <span className="text-small font-medium text-ink-muted">Condition {condition.number}</span>
                <ClampedWords text={condition.text} />
              </li>
            ))}
          </ol>
          <WordsToggle what={count === 1 ? "the condition" : "the conditions"} />
        </div>
      )}

      {note && (
        <div className="flex flex-col gap-0.5">
          {/* Under the conditions it needs its own label; alone, the box's heading is that label. */}
          {count > 0 && <h3 className="text-small font-medium text-ink-muted">Chief Inspector&apos;s note</h3>}
          <blockquote className="leading-relaxed">“{note}”</blockquote>
        </div>
      )}
    </section>
  );
}
