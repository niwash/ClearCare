"use client";

// The one status message for the shortlist (CCARE-127). It sits in the header, so it's on every page
// and never leaves it: screen readers hear each add, remove and clear, even when the button that
// made the change has gone with its home.
import { useAnnouncement } from "./compare-store";

export function CompareStatus() {
  const message = useAnnouncement();
  return (
    <span role="status" className="sr-only">
      {message}
    </span>
  );
}
