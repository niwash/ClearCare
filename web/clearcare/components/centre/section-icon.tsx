// components/centre/section-icon.tsx
// The round, softly tinted icon beside each heading on the centre page, as "Worth asking on a
// visit" has (CCARE-179), so the record reads as sections of one page rather than a form. The
// adult-centred design turns the tints to its band colour (globals.css). Decorative: the heading
// beside it says the same in words.
import { Icon, type IconName } from "@/components/ui/icons";

// Written out in full so Tailwind finds them.
const TINTS = {
  blue: "bg-tint-blue text-on-tint-blue",
  gold: "bg-tint-gold text-on-tint-gold",
  sage: "bg-tint-sage text-on-tint-sage",
  rose: "bg-tint-rose text-on-tint-rose",
} as const;

export function SectionIcon({ name, tint }: { name: IconName; tint: keyof typeof TINTS }) {
  return (
    <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-full ${TINTS[tint]}`}>
      <Icon name={name} className="size-[1.125rem]" />
    </span>
  );
}

// The card each section sits on: rounded and lifted a little in the standard design, like the
// "About this home" box; square-cornered with a 3:1 edge and no shadow in the adult-centred one.
export const sectionCardClass =
  "rounded-2xl border border-line-soft bg-surface shadow-sm adult:rounded-lg adult:border-line adult:shadow-none";
