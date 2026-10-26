import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The start page used to be /home; old links and bookmarks still reach it.
      { source: "/home", destination: "/", permanent: true },
      // There is no guides index; the guides are listed on the resources page, which the guides'
      // breadcrumb points to. Not permanent, so a guides page can take the address later.
      { source: "/guides", destination: "/resources", permanent: false },
    ];
  },
};

export default nextConfig;
