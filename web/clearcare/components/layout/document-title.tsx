"use client";

import { useEffect } from "react";

// Sets the tab's title from the browser, for a page that can't export metadata: the 404 page
// (NotFoundContent, shown by app/not-found.tsx and app/(site)/not-found.tsx). For an address that matches no page, the root layout's metadata renders
// "ClearCare" and writes it back after this has run, so the title is watched and set again whenever
// it changes. Search engines don't need it, as a 404 is marked noindex.
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
  return null;
}
