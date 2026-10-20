export type Guide = {
  slug: string;
  title: string;
  summary: string;
  // Unset when the guide is finished. A draft is readable but still changing; a coming-soon
  // guide isn't written yet, so the resources page lists it without a link.
  status?: "draft" | "coming-soon";
};

// In the order a family needs them: the overview, what to ask, the reports, then paying.
export const GUIDES = [
  {
    slug: "user-journey",
    title: "How a family chooses a nursing home",
    summary: "From the first conversation to moving in, and what to do if the answer is no.",
  },
  {
    slug: "choosing-a-nursing-home",
    title: "Choosing a nursing home: questions to ask",
    summary: "Questions to ask before and during your search.",
    status: "draft",
  },
  {
    slug: "reading-inspection-reports",
    title: "How to read a HIQA inspection report",
    summary: "What each part of a report means.",
    status: "draft",
  },
  {
    slug: "fair-deal",
    title: "Fair Deal explained",
    summary: "How the scheme works, who qualifies and how to apply.",
    status: "coming-soon",
  },
] as const satisfies readonly Guide[];

export type GuideSlug = (typeof GUIDES)[number]["slug"];

// The slug type guarantees a match, so each guide page gets a Guide, not undefined.
export function getGuide(slug: GuideSlug): Guide {
  return GUIDES.find((guide) => guide.slug === slug)!;
}
