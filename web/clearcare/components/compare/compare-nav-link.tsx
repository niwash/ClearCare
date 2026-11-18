"use client";

// "Compare Homes" in the navigation (CCARE-127). It links straight to the saved homes, so the page
// opens with them. No count beside it (CCARE-258): how many are saved is on "Your shortlist" in the
// header's top band, beside it on every page.
import Link from "next/link";
import { compareHref } from "@/lib/compare";
import { useComparedHomes } from "./compare-store";

// current: this is the page being shown, which the navigation marks (nav-item.tsx, CCARE-258).
export function CompareNavLink({ label, className, current }: { label: string; className: string; current?: boolean }) {
  const homes = useComparedHomes();

  return (
    <Link href={compareHref(homes?.map((home) => home.id) ?? [])} className={className} aria-current={current ? "page" : undefined}>
      {label}
    </Link>
  );
}
