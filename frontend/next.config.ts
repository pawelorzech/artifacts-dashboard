import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "artifactsmmo.com",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
