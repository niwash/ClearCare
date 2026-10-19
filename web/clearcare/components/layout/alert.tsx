import type { ReactNode } from "react";

// A problem message. In the adult-centred design it also gets a thicker border and a warning
// icon, so colour is never the only signal.
export function Alert({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-danger bg-surface p-5 text-sm adult:border-2">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="mt-px hidden shrink-0 text-danger adult:block">
        <path d="M10 2 L18.5 17 H1.5 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M10 8 V11.5 M10 14 V14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-ink-muted">{children}</p>
      </div>
    </div>
  );
}
