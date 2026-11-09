// components/centre/centre-contents.tsx
// The centre page's sections as a rounded menu of links under the home's name that stays near the
// top of the window while the page scrolls (CCARE-207). It floats, centred and lifted, rather than
// running edge to edge, so it isn't taken for a second site header. The section being read is a
// filled pill (ContentsTracker). A section with entries of its own ("What happened next" and its
// trails) has an arrow that opens them as a list under the menu; it opens only when asked, since a
// list that opened by itself would cover the page being read. On narrow screens the links scroll
// sideways inside the menu.
import { Chevron } from "@/components/ui/chevron";
import { ContentsTracker } from "./contents-tracker";

export interface ContentsItem {
  id: string;
  title: string;
  children?: ContentsItem[];
}

const BAR_ID = "centre-contents";

// Where a jump to a section lands: clear of the menu. Give it to every element the menu links to.
export const contentsScrollMargin = "scroll-mt-24";

// Where the reader is (ContentsTracker sets aria-current): a filled pill with bold text, so it is
// shown by shape and weight as well as colour.
const currentPill = "aria-[current=location]:bg-tint-blue aria-[current=location]:font-bold aria-[current=location]:text-on-tint-blue";
// In the menu the fill is on the item, not the link, so a section with an arrow ("What happened
// next") is filled as one pill, the arrow included; the link only turns bold.
const currentItem = "rounded-full has-aria-[current=location]:bg-tint-blue adult:rounded-md";
const currentText = "aria-[current=location]:font-bold aria-[current=location]:text-on-tint-blue";

export function CentreContentsBar({ items, className = "" }: { items: ContentsItem[]; className?: string }) {
  const withEntries = items.find((item) => item.children?.length);
  return (
    // Sticky a little below the top of the window. The nav itself is only as wide as the page's
    // column; the menu inside is as wide as its links, centred, and no wider than the column.
    <nav id={BAR_ID} aria-label="On this page" className={`group/bar sticky top-3 z-20 flex justify-center ${className} print:hidden`}>
      <ContentsTracker navId={BAR_ID} />
      <div className="relative max-w-full rounded-full border border-line-soft bg-surface/95 p-1.5 shadow-md supports-[backdrop-filter]:bg-surface/85 supports-[backdrop-filter]:backdrop-blur adult:rounded-lg adult:border-line adult:shadow-none">
        <ul data-contents-scroller className="flex gap-1 overflow-x-auto rounded-full [scrollbar-width:none] adult:rounded-md [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <li key={item.id} className={`flex shrink-0 items-center ${currentItem}`}>
              <a
                href={`#${item.id}`}
                data-level="1"
                className={`flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold text-ink no-underline hover:bg-surface-muted hover:text-primary adult:rounded-md ${
                  item.children?.length ? "pr-0.5" : ""
                } ${currentText}`}
              >
                {item.title}
              </a>
              {item.children?.length ? (
                <button
                  type="button"
                  data-contents-toggle
                  aria-expanded="false"
                  aria-controls={`${item.id}-entries`}
                  // The arrow sits right after the title, so the pair reads as one dropdown, while the
                  // button stays 44px tall to tap (and 44px wide in the adult-centred design).
                  // relative: holds its sr-only label (position: absolute) inside the scrolling list.
                  // Without it the label was placed against the outer menu, outside the list's
                  // clipping, and where the links ran off screen it widened the page on phones, which
                  // then zoomed out (CCARE-214, seen on /centres/465).
                  className="relative flex h-11 w-8 shrink-0 cursor-pointer items-center justify-start rounded-r-full pl-0.5 text-primary hover:bg-surface-muted adult:w-11 adult:rounded-md"
                >
                  <span className="sr-only">
                    {item.children.length} entries under {item.title}
                  </span>
                  <Chevron className="size-4 rotate-90 group-data-[open=true]/bar:-rotate-90" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        {/* Outside the scrolling list, so it isn't cut off by it. */}
        {withEntries?.children && (
          <ul
            id={`${withEntries.id}-entries`}
            className="absolute right-0 top-full z-30 mt-2 hidden max-h-[60vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-2xl border border-line-soft bg-surface p-2 shadow-lg group-data-[open=true]/bar:flex adult:rounded-lg adult:border-line adult:shadow-none"
          >
            {withEntries.children.map((child) => (
              <li key={child.id}>
                <a
                  href={`#${child.id}`}
                  data-level="2"
                  className={`block rounded-xl px-3 py-2.5 text-sm leading-snug text-ink no-underline hover:bg-surface-muted hover:text-primary adult:rounded-md ${currentPill}`}
                >
                  {child.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
