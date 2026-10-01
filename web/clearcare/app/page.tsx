import { PlaceholderEventList } from "@/components/event-list";
import { Placeholder } from "@/components/placeholder";
import { Section } from "@/components/section";

export default function StartPage() {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-[2fr_1fr] md:gap-10">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">
            Check a nursing home&apos;s record
          </h1>
          <p className="text-ink-muted md:text-lg">
            Every HIQA inspection report, one page per home. Every line links back to the report it came from.
          </p>
          <form action="/" role="search" aria-label="Find a nursing home" className="flex gap-2">
            <label htmlFor="start-search" className="sr-only">
              Nursing home name, town or Eircode
            </label>
            <input
              id="start-search"
              name="q"
              type="search"
              placeholder="Name, town or Eircode"
              className="h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3"
            />
            <button type="submit" className="h-11 rounded-md bg-link px-4 font-semibold text-surface">
              Search
            </button>
          </form>
          <p className="text-xs text-ink-muted md:text-sm">
            545 registered centres. Latest HIQA reports added on <Placeholder>date</Placeholder>.
          </p>
        </div>
        <aside className="rounded-lg border border-line bg-surface p-4 text-sm">
          <h2 className="font-semibold">What this site doesn&apos;t do</h2>
          <p className="mt-1 text-ink-muted">
            It doesn&apos;t rate or recommend homes, and it can&apos;t tell you where there&apos;s a free bed. For that,
            ask the home or the hospital social worker.
          </p>
        </aside>
      </div>

      <Section
        title={
          <>
            An example: <Placeholder>Centre name</Placeholder>
          </>
        }
      >
        <PlaceholderEventList count={5} />
      </Section>

      <Section title="Recent changes across Ireland">
        <PlaceholderEventList count={4} />
      </Section>
    </>
  );
}
