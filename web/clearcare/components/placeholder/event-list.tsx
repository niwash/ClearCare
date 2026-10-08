import { Placeholder } from "./placeholder";

export function PlaceholderEventList({ count }: { count: number }) {
  return (
    <ol className="divide-y divide-line-soft rounded-lg border border-line bg-surface">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[7rem_8rem_1fr]"
        >
          <span className="font-mono text-xs text-ink-muted md:text-sm">
            <Placeholder>date</Placeholder>
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted md:text-sm md:normal-case md:tracking-normal">
            <Placeholder>source</Placeholder>
          </span>
          <span className="col-span-2 md:col-span-1">
            <Placeholder>what happened</Placeholder>
          </span>
        </li>
      ))}
    </ol>
  );
}
