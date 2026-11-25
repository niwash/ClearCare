// lib/county-figures.ts
// A county's figures and how the search page words them (CCARE-308). The number of homes with a
// Fair Deal price tells the reader how many homes the range describes.
import { formatWeeklyPrice } from "./centre-format.ts";
import type { CentreSummary } from "./search.ts";

type CentreFigures = Pick<CentreSummary, "maximum_occupancy" | "contract_price">;

type CountyFigures = {
  centres: number;
  residents: number | null;
  weeklyPrices: { count: number; lowest: number; highest: number } | null;
};

export function countyFigures(centres: readonly CentreFigures[]): CountyFigures {
  // Residents only when every home has a registered occupancy: a sum that leaves a home out would
  // be part of the county, and "in all" would be untrue.
  let residents: number | null = 0;
  let weeklyPrices: CountyFigures["weeklyPrices"] = null;
  for (const { maximum_occupancy, contract_price } of centres) {
    residents = residents === null || maximum_occupancy === null ? null : residents + maximum_occupancy;
    if (contract_price != null) {
      weeklyPrices = weeklyPrices
        ? {
            count: weeklyPrices.count + 1,
            lowest: Math.min(weeklyPrices.lowest, contract_price),
            highest: Math.max(weeklyPrices.highest, contract_price),
          }
        : { count: 1, lowest: contract_price, highest: contract_price };
    }
  }
  return { centres: centres.length, residents, weeklyPrices };
}

export function countyFiguresCopy(county: string, { centres, residents, weeklyPrices }: CountyFigures) {
  const oneHome = centres === 1;
  const homes = `${centres.toLocaleString("en-IE")} nursing ${oneHome ? "home" : "homes"}`;
  const occupancy = residents === null ? "" : `, registered for ${residents.toLocaleString("en-IE")} ${residents === 1 ? "resident" : "residents"}`;
  const paragraph = [`Co. ${county} has ${homes}${occupancy && !oneHome ? `${occupancy} in all` : occupancy}.`];
  const description = [`${homes} in Co. ${county}${occupancy}.`];

  if (weeklyPrices) {
    const { count: priced, lowest, highest } = weeklyPrices;
    const count = priced.toLocaleString("en-IE");
    let listing = `${count} of them list`;
    if (oneHome) listing = "It lists";
    else if (priced === 1) listing = "1 of them lists";
    else if (priced === centres) listing = `All ${count} list`;

    const low = formatWeeklyPrice(lowest);
    if (lowest === highest) {
      paragraph.push(`${listing} a Fair Deal price of ${low} a week.`);
      description.push(`Fair Deal price of ${low} a week.`);
    } else {
      const range = `from ${low} to ${formatWeeklyPrice(highest)} a week.`;
      paragraph.push(`${listing} a Fair Deal price, ${range}`);
      description.push(`Fair Deal prices ${range}`);
    }
  }
  description.push(`See what HIQA's inspectors found at ${oneHome ? "the" : "each"} home.`);
  return { paragraph: paragraph.join(" "), description: description.join(" ") };
}
