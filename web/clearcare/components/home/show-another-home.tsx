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
        className="w-fit text-left text-primary underline underline-offset-2 hover:text-primary-hover disabled:cursor-wait disabled:text-ink-muted disabled:no-underline tap-target adult:decoration-2"
      >
        {pending ? "Picking another home…" : "Show another home"}
      </button>
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
    </>
  );
}
