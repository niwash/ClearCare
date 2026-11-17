"use client";
// components/home/show-another-home.tsx
// "Show another home" under the home page's example (sample-centre.tsx). It asks the server to draw
// the page again, which picks a new home, without reloading it, so the reader stays where they are
// on the page rather than being sent back to the top (CCARE-179). The old home stays until the new
// one arrives, and the new home's name is announced, as nothing else moves to say it changed.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export function ShowAnotherHome({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  // Only announce a name the button brought in, not the first one on the page.
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) setMessage(`Now showing ${currentName}.`);
  }, [currentName]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          asked.current = true;
          startTransition(() => router.refresh());
        }}
        disabled={pending}
        // An outlined button, as the card's links to the record's tabs beside it (CCARE-232): it was
        // a small underlined link, easy to miss.
        className="inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:border-primary disabled:cursor-wait disabled:text-ink-muted disabled:hover:border-line adult:rounded-md"
      >
        {/* Two arrows in a circle: again, with another. */}
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
          <path d="M20 11a8 8 0 0 0-14.500-4M4 4v3.500h3.500M4 13a8 8 0 0 0 14.500 4M20 20v-3.500h-3.500" />
        </svg>
        {pending ? "Picking another home…" : "Show another home"}
      </button>
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
    </>
  );
}
