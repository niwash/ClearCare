// lib/price-context.ts
// Whether a home's weekly price is far below what homes of its kind charge (CCARE-290): less than
// half their median, which GET /centres/{centre_id} gives as typical_contract_price. The HSE's list
// has one public home at €342 a week where the median is €1,964; the site shows the list's figure
// and says it is unusual, as it can't know whether the list is wrong. The tests load this file as
// it is (tests/price-context.test.ts), so it has no imports.
export function farBelowTypical(price: number | null | undefined, typical: number | null | undefined) {
  return typeof price === "number" && typeof typical === "number" && price < typical / 2;
}
