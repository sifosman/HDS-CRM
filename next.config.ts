import type { NextConfig } from "next";

const SUPABASE_URL = "https://xzsibbbghotreolzwnyk.supabase.co";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xzsibbbghotreolzwnyk.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },
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
