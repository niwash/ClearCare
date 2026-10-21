"use client";

import { useEffect, useRef, useState } from "react";
import { primaryButtonClass } from "@/components/ui/classes";

type Leaving = { href: string; host: string; newTab: boolean };

// The website a link goes to, if it isn't this one. Phone and email links (tel:, mailto:) open an
// app rather than a website, so they go straight through.
function externalLink(anchor: HTMLAnchorElement): Leaving | null {
  if (anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.origin === window.location.origin) return null;
  return { href: url.href, host: url.hostname.replace(/^www\d*\./, ""), newTab: anchor.target === "_blank" };
}

// Asks before any link takes someone to another website, on every page. It listens for clicks on
// the whole document, so links need nothing of their own to get it. A click with Ctrl, Cmd, Shift
// or the middle button already opens a new tab or window, so ClearCare stays open and it goes
// straight through. Esc, "Stay on ClearCare" or a click outside the box cancels.
export function LeavingSiteDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [leaving, setLeaving] = useState<Leaving | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const link = externalLink(anchor);
      if (!link) return;
      event.preventDefault();
      setLeaving(link);
      dialog.current?.showModal();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  function close() {
    dialog.current?.close();
  }

  function go() {
    if (!leaving) return;
    close();
    if (leaving.newTab) window.open(leaving.href, "_blank", "noopener,noreferrer");
    else window.location.assign(leaving.href);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="leaving-h"
      aria-describedby="leaving-text"
      onClose={() => setLeaving(null)}
      // A click on the backdrop lands on the dialog itself, not on its contents.
      onClick={(event) => event.target === event.currentTarget && close()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-3 p-6">
        <h2 id="leaving-h" className="font-heading text-xl font-semibold md:text-2xl">
          You&apos;re leaving ClearCare
        </h2>
        <p id="leaving-text" className="text-ink-muted">
          This link goes to <span className="font-semibold text-ink">{leaving?.host}</span>, outside of ClearCare.
          Are you sure you want to leave?
        </p>
        <div className="mt-3 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          {/* Focused first, so pressing Enter by mistake keeps people here. */}
          <button
            type="button"
            onClick={close}
            autoFocus
            className="h-11 whitespace-nowrap rounded-md border border-line bg-surface px-4 font-semibold text-ink hover:border-primary"
          >
            Stay on ClearCare
          </button>
          {/* The website's name is in the sentence above, so the label stays short and on one line. */}
          <button type="button" onClick={go} className={`${primaryButtonClass} whitespace-nowrap`}>
            Continue<span className="sr-only"> to {leaving?.host}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
