// The start of the home page's slide-up (CCARE-186, components/ui/slide-up.tsx), run in the root
// layout's <head> before the page is painted, so the blocks start hidden rather than showing and
// then jumping away. Only on the home page, whose opening blocks slide up as it opens; the other
// pages that slide blocks up show what is on screen at once (slideOnOpen in slide-up.tsx), so they
// have nothing to hide before the first paint. Not where the slide-up never runs (see motionAllowed
// in slide-up.tsx). If the page's JavaScript never starts, the blocks are shown again after a few
// seconds. In the layout rather than the page: React doesn't run a script it renders itself, as it
// would when the home page is reached through a link.
export const SLIDE_UP_SCRIPT = `(function () {
  try {
    var root = document.documentElement;
    if (location.pathname !== "/" || root.dataset.design === "adult-centred" || !("IntersectionObserver" in window) ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.dataset.slideUp = "";
    setTimeout(function () { if (!("slideUpReady" in root.dataset)) delete root.dataset.slideUp; }, 4000);
  } catch (error) {}
})();`;
