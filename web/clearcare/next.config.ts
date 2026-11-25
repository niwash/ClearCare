import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Crawlers and page audits look in the head for each centre's title and description.
  // Requests without a User-Agent still get streamed metadata because Next checks for the header first.
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      {
        // Every address: ":path*" is zero or more segments, so it matches "/" as well.
        source: "/:path*",
        headers: [
          // Tells a browser to use HTTPS for clearcare.ie for a year from each visit (CCARE-311).
          // The site redirects HTTP to HTTPS, but without this a browser's first request can still
          // go out over HTTP. No includeSubDomains: the other hostnames under clearcare.ie are not
          // all known to serve HTTPS. No preload, which needs includeSubDomains.
          // Next leaves this header off the redirects below and its own trailing-slash redirect;
          // the page each one leads to carries it.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // The start page used to be /home; old links and bookmarks still reach it. Not permanent, so
      // the address can be used again later, such as for an account page.
      { source: "/home", destination: "/", permanent: false },
      // The family guide's old address (CCARE-164); old links and bookmarks still reach it. Not
      // permanent, like the others, so browsers don't hold on to it.
      { source: "/guides/user-journey", destination: "/guides/how-a-family-chooses", permanent: false },
      // The log-in page is gone: the controls post straight to Cognito now, so old bookmarks of
      // /login land on the start page instead of a 404. Not permanent, so the address is free later.
      { source: "/login", destination: "/", permanent: false },
      // There is no guides index; the guides are listed on the resources page, which the guides'
      // breadcrumb points to. Not permanent, so a guides page can take the address later.
      { source: "/guides", destination: "/resources", permanent: false },
      // Pages given addresses in the words of their headings (CCARE-297). Permanent, so a search
      // engine moves what it holds to the new address; the old ones won't be used for anything else.
      { source: "/national", destination: "/national-figures", permanent: true },
      { source: "/national/:path*", destination: "/national-figures/:path*", permanent: true },
      { source: "/contacts", destination: "/support-services", permanent: true },
    ];
  },
  // Only the Docker image needs it (Dockerfile); elsewhere it slows each build and npm start warns.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
