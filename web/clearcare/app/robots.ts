// app/robots.ts
// /robots.txt (CCARE-289): every page may be read but the site's own routes and a visitor's
// comparison, and where the list of pages is.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/compare"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
