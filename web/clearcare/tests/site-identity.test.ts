import assert from "node:assert/strict";
import { test } from "node:test";

import { siteIdentity } from "../lib/site-identity.ts";

test("describes ClearCare and its website with full addresses on the live site", () => {
  assert.deepEqual(siteIdentity(), {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "ClearCare",
        url: "https://clearcare.ie",
        logo: "https://clearcare.ie/logos/icon-512.png",
        email: "hello@clearcare.ie",
        description: "ClearCare is a free, independent website that helps people find and compare nursing homes in Ireland using public information.",
      },
      { "@type": "WebSite", name: "ClearCare", url: "https://clearcare.ie" },
    ],
  });
});
