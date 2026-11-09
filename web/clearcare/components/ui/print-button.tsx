"use client";

// components/ui/print-button.tsx
// Prints the page, for a list a family takes with them, such as the questions to ask on a visit.
export function PrintButton({ label = "Print this list", className = "" }: { label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-primary adult:rounded-md print:hidden ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />
      </svg>
      {label}
    </button>
  );
}
