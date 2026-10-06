// components/judgement-icon.tsx
import type { Judgement, PromiseStatus } from "@/lib/centres";

export const JUDGEMENT_LABELS: Record<Judgement, string> = {
  compliant: "Compliant",
  "substantially-compliant": "Substantially compliant",
  "not-compliant": "Not compliant",
  "not-assessed": "Not assessed",
};

export const JUDGEMENT_ORDER: Judgement[] = ["compliant", "substantially-compliant", "not-compliant", "not-assessed"];

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
          className="text-not-assessed"
        />
      )}
    </svg>
  );
}

export const PROMISE_STATUS_LABELS: Record<PromiseStatus, string> = {
  done: "Reported done",
  "in-progress": "Reported in progress",
  "not-done": "Reported not done",
};

export function PromiseStatusIcon({ status }: { status: PromiseStatus }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0 text-link">
      {status === "done" && (
        <>
          <circle cx="7" cy="7" r="6" fill="currentColor" />
          <path d="M4 7.2 L6.2 9.3 L10 5" className="stroke-surface" strokeWidth="1.6" fill="none" />
        </>
      )}
      {status === "in-progress" && (
        <>
          <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7 1.5 A5.5 5.5 0 0 1 12.5 7 L7 7 Z" fill="currentColor" />
        </>
      )}
      {status === "not-done" && <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />}
    </svg>
  );
}
