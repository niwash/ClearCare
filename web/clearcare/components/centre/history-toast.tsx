// components/centre/history-toast.tsx
"use client";

import { useEffect, useRef, useState } from "react";

// How long the message stays on screen, unless the pointer or keyboard focus is on it.
const SHOW_FOR_MS = 4000;

// Confirms what changed after one of the history's "Show all / fewer" toggles: the years the
// inspections now cover, or that there are more or fewer regulations. Not on first load: only
// when one of the messages changes, and it shows the one that did. It can be closed, and it
// waits while someone is reading it (WCAG 2.2.1, Timing Adjustable).
export function HistoryToast({ inspectionsMessage, regulationsMessage }: { inspectionsMessage: string; regulationsMessage: string }) {
  const last = useRef({ inspectionsMessage, regulationsMessage });
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const changed =
      inspectionsMessage !== last.current.inspectionsMessage
        ? inspectionsMessage
        : regulationsMessage !== last.current.regulationsMessage
          ? regulationsMessage
          : null;
    last.current = { inspectionsMessage, regulationsMessage };
    if (!changed) return;
    setText(changed);
    setVisible(true);
  }, [inspectionsMessage, regulationsMessage]);

  // Restarts for each new message, and stops while paused.
  useEffect(() => {
    if (!visible || paused) return;
    const timer = setTimeout(() => setVisible(false), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [visible, paused, text]);

  function close() {
    setVisible(false);
    setPaused(false);
  }

  return (
    <>
      {/* Always in the page, so screen readers announce each new message. */}
      <p role="status" className="sr-only">
        {text}
      </p>
      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex justify-center">
        <div
          aria-hidden={!visible}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onKeyDown={(event) => event.key === "Escape" && close()}
          className={`pointer-events-auto flex items-center gap-3 rounded-lg bg-ink py-2 pl-8 pr-2 text-surface shadow-xl transition-[opacity,visibility] duration-300 motion-reduce:transition-none ${
            visible ? "visible opacity-100" : "invisible opacity-0"
          }`}
        >
          <p aria-hidden className="py-3 text-lg font-semibold md:text-xl">
            {text}
          </p>
          <button
            type="button"
            aria-label="Close message"
            onClick={close}
            className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-surface/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-surface"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="size-5">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
