// app/sitemap.ts
// /sitemap.xml (CCARE-289): the site's pages and every home's, so a search engine has the list
// without having to find each home through search.
import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { apiUrl } from "@/lib/api-url";
import { SITE_URL } from "@/lib/site-url";
import { allCentreIds, sitemapPaths } from "@/lib/sitemap";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // On each request, as the search reads the API: a build has no API, and would keep a list
  // without the homes until the next build.
  await connection();
  const api = apiUrl();
  if (!api) throw new Error("API_URL isn't set.");
  // The register changes once a day at most, so the list is asked for once a day.
  const ids = await allCentreIds(api, (url) => fetch(url, { next: { revalidate: 86400 } }));
  return sitemapPaths(ids).map((path) => ({ url: `${SITE_URL}${path}` }));
}
