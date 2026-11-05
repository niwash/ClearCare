// components/centre/centre-contents.tsx
// The centre page's sections at a glance (CCARE-207). On wide screens, a list down the left that
// stays in view while the page scrolls, as on Wikipedia, on a soft warm tint. A section's own
// entries (the "what happened" trails) fold away until the reader is in that section or opens them
// with the arrow beside it, so the list stays short but nothing is out of reach. Narrower screens
// have no room beside the record, so they get the guides' row of numbered links at the top instead
// (ContentsNav), with the top-level sections only.
import { ContentsNav } from "@/components/guides/step-number";
import { Chevron } from "@/components/ui/chevron";
import { ContentsTracker } from "./contents-tracker";

export interface ContentsItem {
  id: string;
  title: string;
  children?: ContentsItem[];
}

const LABEL = "On this page";
const SIDEBAR_ID = "centre-contents";

// Where the reader is (ContentsTracker sets aria-current): the bar on the left in brand colour,
// and the link in brand colour and bold, so it isn't shown by colour alone.
const currentClass = "aria-[current=location]:border-primary aria-[current=location]:font-bold aria-[current=location]:text-primary";

// The sticky list. Its own scroll keeps a long list of trails reachable on a short window. Gold in
// the standard design; the adult-centred design turns the tint to its band colour and adds an edge.
export function CentreContentsSidebar({ items }: { items: ContentsItem[] }) {
  return (
    <nav
      id={SIDEBAR_ID}
      aria-label={LABEL}
      className="sticky top-6 hidden max-h-[calc(100vh-3rem)] self-start overflow-y-auto rounded-2xl bg-tint-gold px-4 py-4 xl:block adult:rounded-lg adult:border adult:border-line print:hidden"
    >
      <ContentsTracker navId={SIDEBAR_ID} />
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-on-tint-gold">{LABEL}</p>
      <ul className="flex flex-col border-l-2 border-line text-sm">
        {items.map((item) => (
          // data-open: the tracker sets it while the reader is in this section or has opened it.
          <li key={item.id} className="group/entry">
            <div className="flex items-center">
              <a
                href={`#${item.id}`}
                data-level="1"
                className={`-ml-0.5 block flex-1 border-l-2 border-transparent py-1.5 pl-3 font-semibold text-ink no-underline hover:text-primary ${currentClass}`}
              >
                {item.title}
              </a>
              {item.children && (
                <button
                  type="button"
                  data-contents-toggle
                  aria-expanded="false"
                  aria-controls={`${item.id}-entries`}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-on-tint-gold hover:bg-surface/60"
                >
                  <span className="sr-only">
                    {item.children.length} entries under {item.title}
                  </span>
                  <Chevron className="size-4 group-data-[open=true]/entry:rotate-90" />
                </button>
              )}
            </div>
            {item.children && (
              <ul id={`${item.id}-entries`} className="mb-1 hidden flex-col group-data-[open=true]/entry:flex">
                {item.children.map((child) => (
                  <li key={child.id}>
                    <a
                      href={`#${child.id}`}
                      data-level="2"
                      className={`-ml-0.5 block border-l-2 border-transparent py-1 pl-6 leading-snug text-ink-muted no-underline hover:text-primary ${currentClass}`}
                    >
                      {child.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

// The row at the top, below xl, where the sidebar is hidden.
export function CentreContentsRow({ items }: { items: ContentsItem[] }) {
  return (
    <div className="xl:hidden print:hidden">
      <ContentsNav label={LABEL} items={items} />
    </div>
  );
}
