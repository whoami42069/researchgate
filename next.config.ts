import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Empty turbopack config to silence warnings - pdf-parse works fine at runtime
  turbopack: {},
  // Mark pdf-parse as external package to avoid bundling issues
  serverExternalPackages: ['pdf-parse', 'canvas'],
};

export default nextConfig;
