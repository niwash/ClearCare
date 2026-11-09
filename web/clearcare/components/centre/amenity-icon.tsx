// components/centre/amenity-icon.tsx
// An amenity's picture, inline before its words (CCARE-225). Draws nothing for an item without one,
// so callers can put it before every item. Decorative: the words beside it say the same.
import { AMENITY_ICON_PATHS } from "@/lib/amenity-icons";

// In the text's colour: the outline stroked and the solid parts filled. The caller sets the size; a
// bit larger in the easier-to-read design, as its text is.
export function AmenityIcon({ item, className = "size-4 adult:size-5" }: { item: string; className?: string }) {
  const paths = AMENITY_ICON_PATHS[item];
  if (!paths) return null;
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
      <path d={paths.stroke} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={paths.fill} fill="currentColor" />
    </svg>
  );
}
