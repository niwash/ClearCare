import type { ReactNode } from "react";

type SectionProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
};

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-xl font-semibold md:text-2xl">{title}</h2>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
