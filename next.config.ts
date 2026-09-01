import type { NextConfig } from "next";

const SUPABASE_URL = "https://xzsibbbghotreolzwnyk.supabase.co";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/storage/:path*",
        destination: `${SUPABASE_URL}/storage/:path*`,
      },
    ];
  },
};

export default nextConfig;
