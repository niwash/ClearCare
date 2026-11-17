"use client";

// components/centre/record-print.tsx
// Printing a home's record (CCARE-212): a button by every tab's heading, and what heads the printed page.
// Printed, a tab is its own content in black on white under the home's name, address and phone,
// which tab it is and the date, so the sheet makes sense on its own; the site's header, the tabs,
// the guides and the footer are left out (print: classes and @media print in globals.css).
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Each tab's printed title, by the end of the path.
const TITLES: Record<string, string> = {
  "": "Overview",
  "look-first": "What to look at first",
  "next-steps": "What happened next",
  inspections: "Inspection history",
  questions: "Questions to ask",
};

function section(pathname: string) {
  return pathname.match(/^\/centres\/[^/]+\/?([^/]*)/)?.[1] ?? "";
}

// What each tab's button prints, said on it.
const LABELS: Record<string, string> = {
  "": "Print overview",
  "look-first": "Print findings",
  "next-steps": "Print what happened",
  inspections: "Print history",
  questions: "Print questions",
};

// Beside each tab's heading, under the banner, so it's clear it prints that tab.
export function RecordPrintButton() {
  const pathname = usePathname();
  const label = LABELS[section(pathname)] ?? "Print this page";
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-primary adult:rounded-md print:hidden"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />
      </svg>
      {label}
    </button>
  );
}

type PrintHeadingProps = { name: string; address: string; phone?: string };

// Shown only on paper. The date is the day it's printed, set by the browser as it prints, so the
// page served from the server doesn't carry a stale one.
export function PrintHeading({ name, address, phone }: PrintHeadingProps) {
  const pathname = usePathname();
  const [today, setToday] = useState("");
  useEffect(() => {
    const stamp = () => setToday(new Date().toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" }));
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);
  return (
    <div className="hidden border-b border-black pb-3 print:block">
      <p className="font-heading text-2xl font-semibold">{name}</p>
      <p className="text-sm">
        {address}
        {phone && ` · ${phone}`}
      </p>
      <p className="mt-1 text-sm font-semibold">
        {TITLES[section(pathname)] ?? "Record"}
        {today && <span className="font-normal"> · printed {today}</span>}
      </p>
    </div>
  );
}
