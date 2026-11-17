import type { Metadata } from "next";

import { NotFoundContent } from "@/components/layout/not-found-content";

// The 404 page for notFound() in a page of this group, such as a home's page whose centre ID isn't
// known (centres/[id]). The group's layout already has the header, footer and <main>, so this is
// only the content. An address that matches no page never reaches this group, so app/not-found.tsx
// handles that, with the header and footer of its own (CCARE-214).

// As in app/not-found.tsx. A home's page also has a title of its own ("Nursing home not found",
// from its generateMetadata); both are in the response, and in a browser the tab ends on the home's
// (seen in the #156 review).
export const metadata: Metadata = { title: "Page not found · ClearCare" };

export default function SiteNotFound() {
  return <NotFoundContent />;
}
