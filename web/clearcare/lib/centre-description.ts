// lib/centre-description.ts
// The description of a home's page, which a search engine shows under its title (CCARE-289). Every
// home's page had the site's one description, so nothing in a list of results told two homes apart.
// The overview gives the home's own facts; each tab says what it holds for that home.

export interface DescribedCentre {
  name: string;
  // "Kilternan, Co. Dublin" (townAndCounty in lib/town.ts).
  where: string;
  residents: number | null;
  // The Fair Deal price as shown, "€1,418"; null for a home without one.
  price: string | null;
  // The day of the latest inspection as shown, "12 Nov 2025"; null when no report gives one.
  inspected: string | null;
}

type Section = "look-first" | "inspections" | "next-steps" | "questions";

const SECTIONS: Record<Section, (home: string) => string> = {
  "look-first": (home) => `What HIQA's inspectors found at ${home}, in the words of the inspection report.`,
  "next-steps": (home) => `What ${home}, said it would do about each inspection finding, and how the next inspection judged it.`,
  inspections: (home) => `Every HIQA inspection of ${home}: how each regulation was judged, and what has changed at the home.`,
  questions: (home) => `Questions to ask on a visit to ${home}, from what its inspection reports say.`,
};

export function centreDescription(centre: DescribedCentre, section?: Section) {
  const home = `${centre.name}, ${centre.where}`;
  if (section) return SECTIONS[section](home);
  // The facts first: a search engine cuts a description at about 160 characters.
  const facts = [
    centre.residents !== null && `up to ${centre.residents} residents`,
    centre.price && `Fair Deal ${centre.price} a week`,
    centre.inspected && `inspected by HIQA on ${centre.inspected}`,
  ].filter(Boolean);
  return `${home}${facts.length ? `: ${facts.join(", ")}` : ""}. What the inspectors found and how the home responded.`;
}
