"use client";
// components/glossary/glossary-list.tsx
// The glossary's terms, A to Z under a letter each (CCARE-283), with three ways to narrow them: a
// search of the words, a letter bar, and a category. A family looking a word up types it or picks
// its first letter; one reading round a topic, such as paying for care, picks its category. They
// combine, and a letter with nothing under it is greyed out rather than leading to an empty page.
// Every term is in the page as sent, so it reads without script and find-in-page finds any term. A
// link to a term the choices hide (/resources/glossary#fair-deal) clears them, so the link lands.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { JUDGEMENT_MEANINGS, JudgementIcon } from "@/components/centre/judgement-icon";
import { Chevron, ShowHide } from "@/components/ui/chevron";
import { primaryButtonClass, textInputClass } from "@/components/ui/classes";
import { Icon } from "@/components/ui/icons";
import type { GlossaryGroup, GlossaryTerm } from "@/lib/glossary";

type Entry = GlossaryTerm & { category: string; categoryTitle: string; letter: string };

const ALL = "all";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// The letter a term is filed under: "3-year cap" is looked for under T, as it is said.
function sortKey(term: GlossaryTerm) {
  return (term.sortAs ?? term.term).toLocaleLowerCase("en-IE");
}

// A search finds a term by its name, its other names or its meaning, ignoring case.
function matches(entry: Entry, query: string) {
  const words = [entry.term, ...(entry.aka ?? []), entry.meaning].join(" ").toLocaleLowerCase("en-IE");
  return words.includes(query.toLocaleLowerCase("en-IE"));
}

export function GlossaryList({ groups, hiqaSourceUrl }: { groups: GlossaryGroup[]; hiqaSourceUrl: string }) {
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState(ALL);
  const [category, setCategory] = useState(ALL);

  const entries: Entry[] = useMemo(
    () =>
      groups
        .flatMap((group) =>
          group.terms.map((term) => ({
            ...term,
            category: group.id,
            categoryTitle: group.title,
            letter: sortKey(term)[0].toLocaleUpperCase("en-IE"),
          })),
        )
        .sort((a, b) => sortKey(a).localeCompare(sortKey(b), "en-IE")),
    [groups],
  );

  const searched = query.trim();
  // What the search and the category leave, before a letter: the letters that still have terms.
  const narrowed = entries.filter(
    (entry) => (category === ALL || entry.category === category) && (!searched || matches(entry, searched)),
  );
  const lettersWithTerms = new Set(narrowed.map((entry) => entry.letter));
  // A chosen letter that the search or category has emptied stops counting, rather than hiding all.
  const activeLetter = letter !== ALL && lettersWithTerms.has(letter) ? letter : ALL;
  const shown = activeLetter === ALL ? narrowed : narrowed.filter((entry) => entry.letter === activeLetter);
  const filtered = Boolean(searched) || activeLetter !== ALL || category !== ALL;

  function clear() {
    setQuery("");
    setLetter(ALL);
    setCategory(ALL);
  }

  // A link to a term opens it, on arrival and on a change of link. One the choices hide clears them
  // first, then repeats the browser's own jump to it, as the term wasn't on the page when the browser
  // looked. Narrowing the list while the address still names a term outside it keeps that choice.
  const termIds = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);
  const anyChoice = useRef(filtered);
  useEffect(() => {
    anyChoice.current = filtered;
  }, [filtered]);
  useEffect(() => {
    function openTerm(id: string) {
      const term = document.getElementById(id);
      if (!(term instanceof HTMLDetailsElement)) return;
      term.open = true;
      term.scrollIntoView();
    }
    function reveal() {
      // A cut-off address (#%E0%A4) can't be decoded, and decodeURIComponent throws: it names no term,
      // so the list is left as it is rather than falling to the error screen (PR #232 review).
      let id: string;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!termIds.has(id)) return;
      if (document.getElementById(id)) return openTerm(id);
      if (!anyChoice.current) return;
      clear();
      requestAnimationFrame(() => openTerm(id));
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [termIds]);

  const byLetter = new Map<string, Entry[]>();
  for (const entry of shown) byLetter.set(entry.letter, [...(byLetter.get(entry.letter) ?? []), entry]);

  const categoryTitle = groups.find((group) => group.id === category)?.title;
  const summary = shown.length === 1 ? "1 term" : `${shown.length} terms`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {/* The search page's bar (search-filters.tsx), so the two read as one site: the box's label in
            view over it and no faded example in it (CCARE-164: people read one as already filled
            in), the box as tall and as marked out as the search page's, Search as tall as the box, and
            the category a labelled select with the site's own arrow. It filters as it is typed;
            Search is there for those who expect to press it. */}
        <form
          role="search"
          aria-label="Search the glossary"
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-col gap-3 md:flex-row md:items-end"
        >
          <div className="flex min-w-0 flex-col gap-1.5 md:max-w-xl md:flex-1">
            <label htmlFor="glossary-q" className="text-sm font-semibold">
              Search by term
            </label>
            <div className="flex items-start gap-3">
              <div className="relative min-w-0 flex-1">
                <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
                <input
                  id="glossary-q"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                  className="h-13 w-full min-w-0 rounded-lg border-2 border-primary bg-surface pr-3 pl-11 text-lg text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 adult:shadow-none"
                />
              </div>
              <button type="submit" className={`${primaryButtonClass} h-13! px-6 text-base`}>
                Search
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="glossary-category" className="text-sm font-semibold">
              Category
            </label>
            <span className={`relative inline-flex ${category === ALL ? "text-ink" : "text-on-tint-blue"}`}>
              <select
                id="glossary-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={`${textInputClass} h-13 w-full appearance-none rounded-full! pl-4 pr-9 font-semibold hover:border-primary adult:rounded-md! ${
                  category === ALL ? "" : "border-primary bg-tint-blue text-on-tint-blue"
                }`}
              >
                <option value={ALL}>All categories</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.title}
                  </option>
                ))}
              </select>
              <Chevron className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90" />
            </span>
          </div>
        </form>

        {/* The letter bar. A letter with no terms, for the search and category chosen, can't be
            pressed. Each button is at least 36px square, so the bar wraps onto two rows on phones. */}
        <nav aria-label="Terms by first letter" className="rounded-lg bg-band px-2 py-2">
          <ul className="flex flex-wrap justify-center gap-0.5">
            {[ALL, ...ALPHABET].map((option) => {
              const pressed = option === activeLetter;
              const empty = option !== ALL && !lettersWithTerms.has(option);
              return (
                <li key={option}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    disabled={empty}
                    onClick={() => setLetter(option)}
                    aria-label={option === ALL ? "All letters" : empty ? `${option}, no terms` : `Terms starting with ${option}`}
                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-semibold ${
                      pressed
                        ? "bg-primary text-on-primary"
                        : empty
                          ? "cursor-default text-ink-muted opacity-40"
                          : "text-ink hover:bg-surface"
                    }`}
                  >
                    {option === ALL ? "All" : option}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {/* Said aloud when the list changes, as it changes out of sight of a screen reader. */}
          <p aria-live="polite">
            {filtered
              ? `Showing ${summary}${categoryTitle ? ` in ${categoryTitle}` : ""}${activeLetter !== ALL ? ` starting with ${activeLetter}` : ""}${searched ? ` matching “${searched}”` : ""}`
              : `All ${summary}, A to Z`}
          </p>
          {filtered && (
            <button type="button" onClick={clear} className="min-h-11 font-semibold text-primary underline">
              Show all terms
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 && (
        <p className="max-w-3xl rounded-lg border border-line bg-surface p-4 md:p-5">
          No terms match &ldquo;{searched}&rdquo;. Try a shorter word, or{" "}
          <button type="button" onClick={clear} className="font-semibold text-primary underline">
            show all terms
          </button>
          .
        </p>
      )}

      {[...byLetter].map(([group, terms]) => (
        <section key={group} aria-labelledby={`letter-${group}`} className="flex flex-col gap-3">
          <h2 id={`letter-${group}`} className="font-heading text-2xl font-semibold text-ink md:text-3xl">
            {group}
          </h2>
          <ul className="grid max-w-4xl gap-2">
            {terms.map((entry) => (
              // Remounted when a search starts or ends, so a search opens what it finds (its words may
              // be in the meaning) and clearing it closes them again.
              <Term
                key={`${entry.id}${searched ? "-found" : ""}`}
                entry={entry}
                open={Boolean(searched)}
                showCategory={category === ALL}
                hiqaSourceUrl={hiqaSourceUrl}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// One term as an accordion, closed until opened (CCARE-164: less scrolling), with the same "Show" /
// "Hide" and arrow as the guides' <details>, no script needed. The summary is the name and, for a
// judgement, its symbol; inside are its category unless one is chosen, any other names, the plain
// meaning and, for a judgement, HIQA's own definition, as the reports a family opens use HIQA's
// words. scroll-mt keeps a term opened from a link clear of the top of the window.
function Term({
  entry,
  open,
  showCategory,
  hiqaSourceUrl,
}: {
  entry: Entry;
  open: boolean;
  showCategory: boolean;
  hiqaSourceUrl: string;
}) {
  const hiqa = entry.judgement ? JUDGEMENT_MEANINGS[entry.judgement] : null;

  return (
    <li>
      <details id={entry.id} open={open} className="group scroll-mt-6 rounded-lg border border-line bg-surface open:border-primary">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-4 md:px-5 [&::-webkit-details-marker]:hidden">
          <h3 className="flex flex-1 items-center gap-2 font-heading text-lg font-semibold md:text-xl">
            {entry.judgement && <JudgementIcon judgement={entry.judgement} size={18} />}
            {entry.term}
          </h3>
          <ShowHide />
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4 md:px-5 md:pb-5">
          {(showCategory || entry.aka) && (
            <div className="flex flex-col gap-0.5">
              {showCategory && (
                <p className="text-sm text-ink-muted">
                  Category: <span className="font-semibold">{entry.categoryTitle}</span>
                </p>
              )}
              {entry.aka && <p className="text-sm text-ink-muted">Also called {entry.aka.join(", ")}</p>}
            </div>
          )}
          <p className="leading-relaxed">{entry.meaning}</p>
          {hiqa?.from === "hiqa" && (
            <div className="mt-1 border-l-4 border-line pl-3 text-sm text-ink-muted">
              <blockquote>{hiqa.text}</blockquote>
              <p className="mt-1">
                <a href={hiqaSourceUrl} target="_blank" rel="noopener noreferrer" className="text-ink-muted">
                  HIQA&apos;s definition<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            </div>
          )}
          {entry.more && (
            <p className="mt-1">
              <Link href={entry.more.href} className="font-semibold">
                More in {entry.more.label} <span aria-hidden>→</span>
              </Link>
            </p>
          )}
        </div>
      </details>
    </li>
  );
}
