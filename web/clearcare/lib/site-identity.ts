// lib/site-identity.ts
// The homepage's structured data identifies ClearCare and its website to search engines (CCARE-309).
// The privacy notice identifies the people who run ClearCare as a team. Google retired the
// sitelinks search box, so the website entry has no SearchAction.
import { CONTACT_EMAIL } from "./contact.ts";
import { SITE_URL } from "./site-url.ts";

export const RUN_BY = "master's students at Technological University Dublin";

export function siteIdentity() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "ClearCare",
        url: SITE_URL,
        logo: `${SITE_URL}/logos/icon-512.png`,
        email: CONTACT_EMAIL,
        description: "ClearCare is a free, independent website that helps people find and compare nursing homes in Ireland using public information.",
      },
      { "@type": "WebSite", name: "ClearCare", url: SITE_URL },
    ],
  };
}
