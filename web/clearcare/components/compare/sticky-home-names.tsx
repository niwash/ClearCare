"use client";

// The comparison grid's frame (CCARE-189): it scrolls sideways when the grid is too wide, and once
// the grid's own header row has scrolled up out of sight, a bar of the homes' names stays at the top
// of the window, over their columns, so a row far down still says whose it is. The bar is a copy of
// the header row for the eye only: screen readers and the keyboard have the real one, so it's hidden
// from them. It's laid out with the grid's own columns and follows the grid when it scrolls sideways.
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
  const scroller = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frameRequest = 0;
    const update = () => {
      frameRequest = 0;
      const head = scroller.current?.querySelector("thead");
      if (!frame.current || !bar.current || !scroller.current || !head) return;
      bar.current.scrollLeft = scroller.current.scrollLeft;
      // Hidden on phones, where the cards replace the grid.
      const laidOut = frame.current.offsetParent !== null;
      const barHeight = bar.current.offsetHeight;
      // From when the header row has gone up past the top until the grid's end reaches the bar.
      setShown(
        laidOut &&
          head.getBoundingClientRect().bottom < 0 &&
          frame.current.getBoundingClientRect().bottom > barHeight,
      );
      // A link or button the keyboard moves to scrolls into view below the bar, not under it.
      document.documentElement.style.scrollPaddingTop = laidOut ? `${barHeight + 8}px` : "";
    };
    const schedule = () => {
      if (!frameRequest) frameRequest = requestAnimationFrame(update);
    };
    const grid = scroller.current;
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    grid?.addEventListener("scroll", schedule, { passive: true });
    // Rows shown or hidden ("Show only rows that differ", "Show all") change where the grid ends.
    const resized = new ResizeObserver(schedule);
    if (grid) resized.observe(grid);
    return () => {
      cancelAnimationFrame(frameRequest);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      grid?.removeEventListener("scroll", schedule);
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
        <div
          ref={bar}
          className={`absolute inset-x-0 top-0 overflow-hidden border-b-2 border-ink bg-surface shadow-md ${shown ? "" : "invisible"}`}
        >
          <table className={tableClass}>
            <colgroup>
              <col className={labelColClass} />
              {names.map((name, i) => (
                <col key={i} />
              ))}
            </colgroup>
            <tbody>
              <tr>
                <td className={`${labelCellClass} py-3 text-sm font-normal`}>{corner}</td>
                {names.map((name, i) => (
                  <td key={i} className={`${homeCellClass} py-3 font-heading font-semibold leading-snug text-ink`}>
                    <span className="line-clamp-2">{name}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div ref={scroller} className="h-full overflow-x-auto rounded-2xl adult:rounded-lg">
        {children}
      </div>
    </div>
  );
}
