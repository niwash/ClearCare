export function Placeholder({ children }: { children: string }) {
  return <span className="text-ink-faint">[{children}]</span>;
}
