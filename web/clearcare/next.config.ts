import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is no guides index; the guides are listed on the resources page, which the guides'
  // breadcrumb points to. Not permanent, so a guides page can take the address later.
  async redirects() {
    return [{ source: "/guides", destination: "/resources", permanent: false }];
  },
};

export default nextConfig;
