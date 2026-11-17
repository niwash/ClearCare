"use client";

// app/(site)/centres/[id]/template.tsx
// Around each page of a home's record, inside the layout (CCARE-212). A template, unlike the layout,
// is made afresh on every move between the record's pages, so the page a tab opens can slide in
// while the name and tabs stay still: from the right when the tab is to the right of the one left,
// from the left when it is to the left, as pages turned in a folder (.tab-from-right and
// .tab-from-left, globals.css). Back and Forward slide the same way, by the same order. Arriving at
// the record from elsewhere, nothing moves.
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// The tabs' order, by the end of the path, as in the layout.
const ORDER = ["", "look-first", "next-steps", "inspections", "questions"];

function place(pathname: string) {
  const match = pathname.match(/^\/centres\/([^/]+)\/?([^/]*)/);
  return match ? { home: match[1], index: ORDER.indexOf(match[2]) } : null;
}

// The record's page shown last, kept between templates: this one replaces the last.
let lastPathname: string | null = null;

export default function CentreRecordTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [motion] = useState(() => {
    const from = lastPathname ? place(lastPathname) : null;
    const to = place(pathname);
    if (!from || !to || from.home !== to.home || from.index === to.index) return "";
    return to.index > from.index ? "tab-from-right" : "tab-from-left";
  });
  // Forgotten when the record is left, so coming back to it from elsewhere doesn't slide. React works
  // out the next template's motion before this one is removed, so a tab change still sees it.
  useEffect(() => {
    lastPathname = pathname;
    return () => {
      lastPathname = null;
    };
  }, [pathname]);

  return <div className={`${motion} flex flex-col`.trim()}>{children}</div>;
}
