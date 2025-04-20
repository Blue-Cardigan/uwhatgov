import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "members-api.parliament.uk",
      },
    ],
  },
};

export default nextConfig;
