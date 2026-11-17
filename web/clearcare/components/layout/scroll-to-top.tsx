"use client";

// components/layout/scroll-to-top.tsx
// A link to another page opens it at the top, header and all (CCARE-212). Next.js scrolls only to
// the top of the part of the page that changed, which left the header out of sight on every page,
// and on a home's record the name and tabs too, as the record's loading outline is replaced. So
// this scrolls to the very top whenever the page's path changes, at once rather than gliding, as
// a new page loads in a browser.
//
// Left alone: Back and Forward, where the browser puts the page back where it was; a link to a
// part of a page (#...); a change of query alone, such as the search filters or Compare's
// toggles; and the tabs of one home's record, which keep the window where it is (centre-tabs.tsx).
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// The home a record's path belongs to, so that moving between its tabs is told apart.
function recordOf(pathname: string) {
  return pathname.match(/^\/centres\/([^/]+)/)?.[1] ?? null;
}

export function ScrollToTop() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  const fromHistory = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      fromHistory.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    const history = fromHistory.current;
    fromHistory.current = false;
    if (from === pathname || history || window.location.hash) return;
    const home = recordOf(pathname);
    if (home && home === recordOf(from)) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
