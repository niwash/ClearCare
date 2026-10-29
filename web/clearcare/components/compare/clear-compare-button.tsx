"use client";

// "Clear the list" on Compare Homes (CCARE-127): takes every saved home off. Shown only while
// there are homes to clear; focus then moves to the page's heading, as the button goes.
import { announce, clearCompared, useComparedHomes } from "./compare-store";

export function ClearCompareButton({ className, focusAfter }: { className: string; focusAfter: string }) {
  const homes = useComparedHomes();

  if (!homes || homes.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => {
        clearCompared();
        announce("Your list is cleared.");
        document.getElementById(focusAfter)?.focus();
      }}
      className={className}
    >
      Clear the list
    </button>
  );
}
