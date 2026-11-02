// components/ui/organisation-icon.tsx
// A generic icon for the kind of organisation behind a contact or a link. Generic on purpose: the
// organisations' own logos are trademarks that their owners let third parties use only with
// permission (CCARE-164), and the HSE only lets its funded partners use its logo. Decorative: the
// organisation's name is always written beside it.
import { IconCircle } from "@/components/ui/icon-circle";

export type OrganisationKind = "public-body" | "regulator" | "charity" | "legal";

const PATHS: Record<OrganisationKind, string> = {
  // A building with columns
  "public-body": "M3 21h18M5 21v-9M10 21v-9M14 21v-9M19 21v-9M2.5 9.5 12 4l9.5 5.5z",
  // A shield with a tick
  regulator: "M12 3 4.5 6v5.5c0 4.4 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5.1 7.5-9.5V6zM9 12l2 2 4-4",
  // A heart
  charity:
    "M12 20s-7.5-4.6-9.2-9.1C1.6 7.6 3.8 4.5 7 4.5c2.1 0 3.9 1.3 5 3 1.1-1.7 2.9-3 5-3 3.2 0 5.4 3.1 4.2 6.4C19.5 15.4 12 20 12 20z",
  // A pair of scales
  legal: "M12 4v16M8 20h8M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z",
};

export function OrganisationIcon({ kind, size = "small" }: { kind: OrganisationKind; size?: "small" | "large" }) {
  return <IconCircle path={PATHS[kind]} size={size} />;
}
