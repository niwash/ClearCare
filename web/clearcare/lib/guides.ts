export type Guide = {
  slug: string;
  title: string;
  summary: string;
  // Unset when the guide is finished. A draft is readable but still changing; a coming-soon
  // guide isn't written yet, so the resources page lists it without a link.
  status?: "draft" | "coming-soon";
  // Sets the mood on the guide's card and at the top of its page; its alt text is empty. Credits
  // are in components/home/feature-carousel.tsx, except navigate.jpg: Andrea Piacquadio,
  // https://www.pexels.com/photo/cheerful-senior-mother-and-adult-daughter-using-smartphone-together-3791664/
  photo: string;
  // Which part of the photo to keep when a wide frame crops it (the guide's banner, its cards),
  // written out in full for Tailwind. Unset keeps the default, about a third of the way down.
  photoFocus?: string;
  // Set when the site header's menu links to the guide, making it one of the site's main pages:
  // its breadcrumb goes straight to Home, though the resources page still lists it.
  inMenu?: true;
};

// In the order a family needs them: the overview, what to ask, the reports, then paying.
export const GUIDES = [
  {
    slug: "how-a-family-chooses",
    title: "How a Family Chooses a Nursing Home",
    summary: "From the first conversation to moving in, and what to do if the answer is no.",
    photo: "/home/family.jpg",
    // The two of them are on the right, faces in the upper half.
    photoFocus: "object-[75%_30%]",
  },
  {
    slug: "choosing-a-nursing-home",
    title: "Choosing a Nursing Home: Questions to Ask",
    summary: "Questions to ask before and during your search.",
    photo: "/home/phone.jpg",
    // The woman is low on the right: keep her face, hand and notes.
    photoFocus: "object-[70%_75%]",
    status: "draft",
  },
  {
    slug: "reading-inspection-reports",
    title: "How to Read a HIQA Inspection Report",
    summary: "What each part of a report means.",
    photo: "/home/report.jpg",
    // Keep her glasses and the documents she is holding.
    photoFocus: "object-[50%_45%]",
    status: "draft",
  },
  {
    slug: "fair-deal",
    title: "Fair Deal Explained",
    summary: "How the scheme works, who qualifies and how to apply.",
    photo: "/home/fair-deal.jpg",
    // Keep both faces and the paperwork under their hands.
    photoFocus: "object-[50%_35%]",
    status: "draft",
    inMenu: true,
  },
  {
    slug: "using-clearcare",
    title: "How to navigate ClearCare",
    summary: "Where to find things on this site and how to use them.",
    photo: "/resources/navigate.jpg",
    // Keep both faces and the phone between them.
    photoFocus: "object-[50%_45%]",
    status: "draft",
  },
] as const satisfies readonly Guide[];

export type GuideSlug = (typeof GUIDES)[number]["slug"];

// The slug type guarantees a match, so each guide page gets a Guide, not undefined.
export function getGuide(slug: GuideSlug): Guide {
  return GUIDES.find((guide) => guide.slug === slug)!;
}
