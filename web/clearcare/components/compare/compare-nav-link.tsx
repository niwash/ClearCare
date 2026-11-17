"use client";

// "Compare Homes" in the navigation (CCARE-127), with how many homes are saved, e.g. "Compare
// Homes (2)". It links straight to those homes, so the page opens with them.
import Link from "next/link";
import { compareHref } from "@/lib/compare";
import { useComparedHomes } from "./compare-store";

// current: this is the page being shown, which the navigation marks (nav-item.tsx, CCARE-258).
export function CompareNavLink({ label, className, current }: { label: string; className: string; current?: boolean }) {
  const homes = useComparedHomes();
  const count = homes?.length ?? 0;

  return (
    <Link href={compareHref(homes?.map((home) => home.id) ?? [])} className={className} aria-current={current ? "page" : undefined}>
      {label}
      {/* How many are saved, in a round badge rather than "(2)" after the words, which was easy to
          miss: in user testing (P2_1, CCARE-258) the participant lost count of their shortlist. In
          the primary colour's reverse, so white with a blue number on the navigation's blue band and
          blue with a white number in the phone menu. Screen readers hear it in words instead. */}
      {count > 0 && (
        <>
          <span
            aria-hidden="true"
            // Raised 2px (relative -top-0.5): set in the middle of the line (align-middle), it sat about
            // 2px below the middle of the capitals beside it, which made it look off centre. tabular-nums,
            // so every figure is the same width and centres the same way. Half a pixel more padding on
            // the right than the left: centred exactly, a 3 (open on the left, heavy on the right) still
            // looked right of centre, so it is nudged towards its open side; enough for a 3, not so much
            // that another figure looks off (the shortlist holds at most five, MAX_COMPARED).
            className="relative -top-0.5 ml-1.5 inline-grid h-6 min-w-6 place-items-center rounded-full bg-primary pr-[6.5px] pl-[5.5px] align-middle text-sm leading-none font-bold tabular-nums text-on-primary"
          >
            {count}
          </span>
          <span className="sr-only">
            {" "}
            ({count} {count === 1 ? "home" : "homes"} saved)
          </span>
        </>
      )}
    </Link>
  );
}
