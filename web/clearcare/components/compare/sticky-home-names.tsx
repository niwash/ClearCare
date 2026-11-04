"use client";

// The comparison grid's frame (CCARE-189): once the grid's own header row has scrolled up out of
// sight, a bar of the homes' names stays at the top of the window, over their columns, so a row far
// down still says whose it is. The groups' headings (CollapsibleGroup) stick just under it: the bar
// sets --names-bar to its height while it shows. The grid always fits the frame's width, rather
// than scrolling sideways, as a box that scrolls would stop those headings sticking to the window.
// The bar is a copy of the header row for the eye only: screen readers and the keyboard have the
// real one, so it's hidden from them. It's laid out with the grid's own columns.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function StickyHomeNames({
  names,
  corner,
  labelColClass,
  labelCellClass,
  homeCellClass,
  tableClass,
  children,
}: {
  names: string[];
  // The text in the grid's top-left cell, repeated in the bar's.
  corner: ReactNode;
  // The grid's column and cell classes, so the bar's columns line up with its columns.
  labelColClass: string;
  labelCellClass: string;
  homeCellClass: string;
  tableClass: string;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frameRequest = 0;
    const update = () => {
      frameRequest = 0;
      const head = frame.current?.querySelector("thead");
      if (!frame.current || !bar.current || !head) return;
      // Hidden on phones, where the cards replace the grid.
      const laidOut = frame.current.offsetParent !== null;
      const barHeight = bar.current.offsetHeight;
      // From when the header row has gone up past the top until the grid's end reaches the bar.
      const show =
        laidOut && head.getBoundingClientRect().bottom < 0 && frame.current.getBoundingClientRect().bottom > barHeight;
      setShown(show);
      frame.current.style.setProperty("--names-bar", show ? `${barHeight}px` : "0px");
      // A link or button the keyboard moves to scrolls into view below the bar and a group's
      // heading, not under them.
      document.documentElement.style.scrollPaddingTop = laidOut ? `${barHeight + 64}px` : "";
    };
    const schedule = () => {
      if (!frameRequest) frameRequest = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    // Groups folded or opened, and "Show all", change where the grid ends.
    const resized = new ResizeObserver(schedule);
    if (frame.current) resized.observe(frame.current);
    return () => {
      cancelAnimationFrame(frameRequest);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      resized.disconnect();
      document.documentElement.style.scrollPaddingTop = "";
    };
  }, []);

  return (
    <div
      ref={frame}
      className="relative h-full rounded-2xl border border-line bg-surface shadow-sm adult:rounded-lg adult:shadow-none"
    >
      {/* No height, so it takes no room above the grid: the bar hangs from it, over the grid. */}
      <div aria-hidden="true" inert className="sticky top-0 z-20 h-0">
        <div ref={bar} className={`absolute inset-x-0 top-0 border-b border-line shadow-md ${shown ? "" : "invisible"}`}>
          {/* The site's brand colour, as on the grid's own header row. */}
          <table className={`brand-band ${tableClass}`}>
            <colgroup>
              <col className={labelColClass} />
              {names.map((name, i) => (
                <col key={i} />
              ))}
            </colgroup>
            <tbody>
              <tr>
                <td className={`${labelCellClass} py-2.5 text-sm font-normal`}>{corner}</td>
                {names.map((name, i) => (
                  <td key={i} className={`${homeCellClass} py-2.5 font-heading text-base font-semibold leading-snug text-ink lg:text-lg`}>
                    <span className="line-clamp-2">{name}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {/* Clips to the rounded corners without becoming a box that scrolls. */}
      <div className="overflow-clip rounded-2xl adult:rounded-lg">{children}</div>
    </div>
  );
}
