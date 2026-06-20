import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    devtoolSegmentExplorer: false,
  },
  outputFileTracingRoot: process.cwd(),
  reactStrictMode: true,
};

export default nextConfig;
