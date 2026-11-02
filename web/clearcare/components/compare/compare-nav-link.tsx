"use client";

// "Compare Homes" in the navigation (CCARE-127), with how many homes are saved, e.g. "Compare
// Homes (2)". It links straight to those homes, so the page opens with them.
import Link from "next/link";
import { compareHref } from "@/lib/compare";
import { useComparedHomes } from "./compare-store";

export function CompareNavLink({ label, className }: { label: string; className: string }) {
  const homes = useComparedHomes();
  const count = homes?.length ?? 0;

  return (
    <Link href={compareHref(homes?.map((home) => home.id) ?? [])} className={className}>
      {label}
      {count > 0 && ` (${count})`}
    </Link>
  );
}
