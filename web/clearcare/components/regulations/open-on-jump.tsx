"use client";

// components/regulations/open-on-jump.tsx
// Lands an in-page jump on its target when the target is inside a folded <details> on the
// regulations page (CCARE-261): "(HIQA, 2025)" opens References and lands on its entry, and
// Regulation 1 or 2 in "Jump to a regulation" opens "Other regulations" and lands on its card. It
// opens every closed box around the target as the link is pressed, and for an address that arrives
// with an anchor (/resources/regulations#ref-framework). Opening is animated (::details-content in
// globals.css), and the browser's own jump happens while the box still has no height, so it scrolls
// again once the opening has finished; without the animation (adult-centred design, reduced motion)
// that second scroll finds the target already in place. Without JavaScript the boxes stay closed,
// and their summaries still say what is in them.
import { useEffect } from "react";

// Longer than the 0.3s opening, in case an animation never reports that it finished.
const SETTLE_MS = 600;

export function OpenOnJump() {
  useEffect(() => {
    let cancelled = false;

    const land = (hash: string) => {
      if (!hash.startsWith("#") || hash.length < 2) return;
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target) return;
      const closed: HTMLDetailsElement[] = [];
      for (let box = target.closest("details"); box; box = box.parentElement?.closest("details") ?? null) {
        if (!box.open) closed.push(box);
      }
      if (closed.length === 0) return;
      closed.forEach((box) => (box.open = true));

      // getAnimations() flushes style, so the opening transitions are already running here.
      const opening = document
        .getAnimations()
        .filter((animation) => {
          const effectTarget = (animation.effect as KeyframeEffect | null)?.target;
          return effectTarget instanceof Node && closed.some((box) => box === effectTarget || box.contains(effectTarget));
        })
        .map((animation) => animation.finished.catch(() => undefined));
      const settle = new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      Promise.race([Promise.all(opening), settle]).then(() => {
        if (!cancelled) target.scrollIntoView();
      });
    };

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href^='#']");
      if (link) land(link.getAttribute("href") ?? "");
    };
    const onHash = () => land(window.location.hash);

    onHash();
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    return () => {
      cancelled = true;
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  return null;
}
