export type Guide = {
  slug: string;
  title: string;
  summary: string;
};

export const GUIDES = [
  {
    slug: "user-journey",
    title: "How a family chooses a nursing home",
    summary: "The steps from first talking it through to moving in, and what to do if the answer is no.",
  },
  {
    slug: "fair-deal",
    title: "Fair Deal explained",
    summary: "How the Nursing Homes Support Scheme works, who qualifies and what do you need to know.",
  },
  {
    slug: "reading-inspection-reports",
    title: "How to read a HIQA inspection report (Draft)",
    summary: "A straightforward guide to nursing home inspection reports.",
  },
  {
    slug: "choosing-a-nursing-home",
    title: "Choosing a nursing home: questions to ask",
    summary: "Questions to ask yourself before and while you search for a home.",
  },
] as const satisfies readonly Guide[];

export type GuideSlug = (typeof GUIDES)[number]["slug"];

// The slug type guarantees a match, so each guide page gets a Guide, not undefined.
export function getGuide(slug: GuideSlug): Guide {
  return GUIDES.find((guide) => guide.slug === slug)!;
}
