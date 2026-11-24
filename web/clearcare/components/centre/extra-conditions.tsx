// components/centre/extra-conditions.tsx
// The extra conditions on a home's registration as it stands, and the Chief Inspector's note on it
// when there is one (CCARE-235), at the top of the overview: a family should know of them before
// anything else on the page. They are HIQA's words, quoted with the condition's number and never
// summarised or given a label of ours. A home with neither has no box.
//
// In the amber of the site's other notes to take care, with the same "i" as Recent changes below it
// (CCARE-297): in plain grey it read as one more card of facts. The amber says "worth knowing", not
// good or bad, so it puts no label of ours on HIQA's words.
import { formatDate, type ExtraCondition } from "@/lib/centres";
import { Icon } from "@/components/ui/icons";
import { ClampedWords, WordsToggle, wordsGroupClass } from "./register-words";

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
    <section
      aria-labelledby="conditions-h"
      className={`${wordsGroupClass} flex flex-col gap-4 rounded-2xl border border-on-tint-gold/30 bg-tint-gold p-4 text-ink md:p-5 adult:rounded-lg`}
    >
      {/* The "i" beside the heading, so the box reads as a note before its words are read. */}
      <div className="flex items-start gap-3">
        <Icon name="info" className="mt-1 size-5 shrink-0 text-on-tint-gold" />
        <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="conditions-h" className="font-heading text-xl font-semibold">
            {count > 0
              ? `${count} extra ${count === 1 ? "condition" : "conditions"} on this home’s registration`
              : "Chief Inspector’s note on this home’s registration"}
          </h2>
          <p className="text-small text-on-tint-gold">
            HIQA&apos;s register, <time dateTime={registerDate}>{formatDate(registerDate)}</time>
          </p>
        </div>
      </div>

      {count > 0 && (
        // In line with the heading's words, past the icon, from tablet width, as in Recent changes.
        <div className="sm:pl-8">
          <ol className="flex flex-col gap-3">
            {conditions.map((condition) => (
              <li key={condition.number} className="flex flex-col gap-0.5">
                <span className="text-small font-medium text-on-tint-gold">Condition {condition.number}</span>
                <ClampedWords text={condition.text} />
              </li>
            ))}
          </ol>
          <WordsToggle what={count === 1 ? "the condition" : "the conditions"} />
        </div>
      )}

      {note && (
        <div className="flex flex-col gap-0.5 sm:pl-8">
          {/* Under the conditions it needs its own label; alone, the box's heading is that label. */}
          {count > 0 && <h3 className="text-small font-medium text-on-tint-gold">Chief Inspector&apos;s note</h3>}
          <blockquote className="leading-relaxed">“{note}”</blockquote>
        </div>
      )}
    </section>
  );
}
