"use client";

// "Compare Homes" in the navigation (CCARE-127). It links straight to the saved homes, so the page
// opens with them. No count beside it (CCARE-258): how many are saved is on "Your shortlist" in the
// header's top band, beside it on every page.
import Link from "next/link";
import { compareHref } from "@/lib/compare";
import { useComparedHomes } from "./compare-store";

// current: "page" for the page being shown, "true" for a page in its section, which the navigation
// marks (nav-item.tsx, CCARE-258, CCARE-296).
export function CompareNavLink({ label, className, current }: { label: string; className: string; current?: "page" | "true" }) {
  const homes = useComparedHomes();

  return (
    <Link href={compareHref(homes?.map((home) => home.id) ?? [])} className={className} aria-current={current}>
      {label}
    </Link>
  );
}
