// components/centre/judgement-icon.tsx
import type { Judgement } from "@/lib/centres";

export const JUDGEMENT_LABELS: Record<Judgement, string> = {
  compliant: "Compliant",
  "substantially-compliant": "Substantially compliant",
  "not-compliant": "Not compliant",
  "not-assessed": "Not assessed",
};

export const JUDGEMENT_ORDER: Judgement[] = ["compliant", "substantially-compliant", "not-compliant", "not-assessed"];

// What each judgement means, shown on hover or tap in the key (CCARE-278). The names stay HIQA's, as
// the reports a family opens use them: in user testing (P2_2) the participant asked what
// "substantially compliant" meant, and took "not assessed" for a bad result.
//
// The three judgements are HIQA's, quoted from Table 1, "Judgment descriptors", of its
// Assessment-judgment framework for designated centres for older people (Version 4.1, May 2025,
// REGULATIONS_SOURCE in lib/regulations.ts): the first sentence of each, word for word. "Not assessed"
// is not one of HIQA's judgements but ClearCare's word for a regulation an inspection didn't judge,
// so its meaning is ClearCare's and says so.
export const JUDGEMENT_MEANINGS: Record<Judgement, { text: string; from: "hiqa" | "clearcare" }> = {
  compliant: {
    text: "A judgment of compliant means the provider and or the person in charge are in full compliance with the relevant regulation.",
    from: "hiqa",
  },
  "substantially-compliant": {
    text: "A judgment of substantially compliant means that the provider or person in charge has generally met the requirements of the regulation but some action is required to be fully compliant.",
    from: "hiqa",
  },
  "not-compliant": {
    text: "A judgment of not compliant means the provider or person in charge has not complied with a regulation and considerable action is required to come into compliance.",
    from: "hiqa",
  },
  "not-assessed": {
    text: "The inspection didn't look at this regulation. This does not mean the regulation has been met or not.",
    from: "clearcare",
  },
};

// Each judgement has its own shape as well as its own colour.
export function JudgementIcon({ judgement, size = 14 }: { judgement: Judgement; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {judgement === "compliant" && <circle cx="7" cy="7" r="5.5" className="fill-ink" />}
      {judgement === "substantially-compliant" && (
        <g className="text-substantially">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7 1.5 A5.5 5.5 0 0 0 7 12.5 Z" fill="currentColor" />
        </g>
      )}
      {judgement === "not-compliant" && (
        <g className="text-not-compliant" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="1.5" y="1.5" width="11" height="11" />
          <path d="M4.5 4.5 L9.5 9.5 M9.5 4.5 L4.5 9.5" />
        </g>
      )}
      {judgement === "not-assessed" && (
        <circle
          cx="7"
          cy="7"
          r="5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeDasharray="2 2"
          className="text-ink"
        />
      )}
    </svg>
  );
}
