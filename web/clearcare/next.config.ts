import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Crawlers and page audits look in the head for each centre's title and description.
  // Requests without a User-Agent still get streamed metadata because Next checks for the header first.
  htmlLimitedBots: /.*/,
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
  async rewrites() {
    return {
      // A county's page is the search for that county alone (CCARE-303), at an address of its own:
      // /nursing-homes/cork (CCARE-297). Before the app's routes, so it isn't taken for a home's.
      // at=county tells the search page it was reached this way, so it doesn't send the visitor on
      // to the address they're already at (app/(site)/search/page.tsx).
      beforeFiles: [{ source: "/nursing-homes/:county", destination: "/search?county=:county&at=county" }],
    };
  },
  // Only the Docker image needs it (Dockerfile); elsewhere it slows each build and npm start warns.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
