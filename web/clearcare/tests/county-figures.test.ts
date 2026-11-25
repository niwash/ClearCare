import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { countyFigures, countyFiguresCopy } from "../lib/county-figures.ts";

describe("a county's figures", () => {
  test("counts every centre and finds the weekly prices, and gives no residents when one home has no registered occupancy", () => {
    const figures = countyFigures([
      { maximum_occupancy: 56, contract_price: 2600 },
      { maximum_occupancy: null, contract_price: null },
      { maximum_occupancy: 44, contract_price: 1242.5 },
      { maximum_occupancy: 50 },
    ]);
    assert.deepEqual(figures, {
      centres: 4,
      residents: null,
      weeklyPrices: { count: 2, lowest: 1242.5, highest: 2600 },
    });
    assert.equal(
      countyFiguresCopy("Leitrim", figures).paragraph,
      "Co. Leitrim has 4 nursing homes. 2 of them list a Fair Deal price, from €1,242.50 to €2,600 a week.",
    );
  });
});

describe("how a county's figures are worded", () => {
  test("says how many list prices in the hero and ends the description with what the page offers", () => {
    assert.deepEqual(
      countyFiguresCopy("Dublin", {
        centres: 106,
        residents: 8596,
        weeklyPrices: { count: 102, lowest: 1242, highest: 2902 },
      }),
      {
        paragraph: "Co. Dublin has 106 nursing homes, registered for 8,596 residents in all. 102 of them list a Fair Deal price, from €1,242 to €2,902 a week.",
        description: "106 nursing homes in Co. Dublin, registered for 8,596 residents. Fair Deal prices from €1,242 to €2,902 a week. See what HIQA's inspectors found at each home.",
      },
    );
  });

  test("says all when every home lists a price", () => {
    const figures = {
      centres: 6,
      residents: 239,
      weeklyPrices: { count: 6, lowest: 1274.5, highest: 2268 },
    };
    assert.equal(
      countyFiguresCopy("Leitrim", figures).paragraph,
      "Co. Leitrim has 6 nursing homes, registered for 239 residents in all. All 6 list a Fair Deal price, from €1,274.50 to €2,268 a week.",
    );
  });

  test("states a single weekly price without a range", () => {
    const figures = countyFigures([
      { maximum_occupancy: 29, contract_price: 1300 },
      { maximum_occupancy: 31, contract_price: null },
    ]);
    assert.deepEqual(figures.weeklyPrices, { count: 1, lowest: 1300, highest: 1300 });
    assert.deepEqual(countyFiguresCopy("Leitrim", figures), {
      paragraph: "Co. Leitrim has 2 nursing homes, registered for 60 residents in all. 1 of them lists a Fair Deal price of €1,300 a week.",
      description: "2 nursing homes in Co. Leitrim, registered for 60 residents. Fair Deal price of €1,300 a week. See what HIQA's inspectors found at each home.",
    });
  });

  test("uses singular wording for one home", () => {
    const figures = countyFigures([{ maximum_occupancy: 1, contract_price: 1300 }]);
    assert.deepEqual(countyFiguresCopy("Leitrim", figures), {
      paragraph: "Co. Leitrim has 1 nursing home, registered for 1 resident. It lists a Fair Deal price of €1,300 a week.",
      description: "1 nursing home in Co. Leitrim, registered for 1 resident. Fair Deal price of €1,300 a week. See what HIQA's inspectors found at the home.",
    });
  });

  test("leaves out residents and prices when none are recorded", () => {
    const figures = countyFigures([{ maximum_occupancy: null, contract_price: null }]);
    assert.deepEqual(figures, { centres: 1, residents: null, weeklyPrices: null });
    assert.deepEqual(countyFiguresCopy("Leitrim", figures), {
      paragraph: "Co. Leitrim has 1 nursing home.",
      description: "1 nursing home in Co. Leitrim. See what HIQA's inspectors found at the home.",
    });
  });
});
