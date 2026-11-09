// components/centre/centre-band.tsx
// A section of a centre's pages on its own full-width band of colour, with the page's column inside
// it. Each section has a different tint, so a record reads as stretches of one page; the
// adult-centred design turns the tints to its band colour (globals.css). Written out in full so
// Tailwind finds them.
import { fullWidthClass } from "@/components/ui/classes";
import type { ReactNode } from "react";

const BAND_TINTS = {
  page: "",
  gold: "bg-tint-gold",
  stone: "bg-band",
  sage: "bg-tint-sage",
  blue: "bg-tint-blue",
} as const;

export function Band({ tint, children }: { tint: keyof typeof BAND_TINTS; children: ReactNode }) {
  return (
    <div className={`${fullWidthClass} ${BAND_TINTS[tint]} py-8 md:py-10`}>
      <div className="page-column px-4 md:px-8">{children}</div>
    </div>
  );
}
