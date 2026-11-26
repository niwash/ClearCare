// lib/calculator-structured-data.ts
// Tells search engines the Fair Deal calculator page is a free tool for estimating a nursing home
// contribution in Ireland, so it can be found by people searching for a "Fair Deal calculator"
// (CCARE-237). Shown in the page's head as JSON-LD, beside the breadcrumb's.
import { SITE_URL } from "./site-url.ts";

export const CALCULATOR_PATH = "/guides/fair-deal/calculator";

export function calculatorStructuredData(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Fair Deal Calculator",
    alternateName: "Nursing Homes Support Scheme calculator",
    url: `${SITE_URL}${CALCULATOR_PATH}`,
    description,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en-IE",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    provider: { "@type": "Organization", name: "ClearCare", url: SITE_URL },
  };
}
