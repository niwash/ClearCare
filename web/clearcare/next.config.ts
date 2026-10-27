import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The start page used to be /home; old links and bookmarks still reach it. Not permanent, so
      // the address can be used again later, such as for an account page.
      { source: "/home", destination: "/", permanent: false },
      // There is no guides index; the guides are listed on the resources page, which the guides'
      // breadcrumb points to. Not permanent, so a guides page can take the address later.
      { source: "/guides", destination: "/resources", permanent: false },
    ];
  },
  // Only the Docker image needs it (Dockerfile); elsewhere it slows each build and npm start warns.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
