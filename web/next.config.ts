import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN: The `ignored` option only works with the default logger of `next@13+
    // default is `[]` which ignores nothing in production.
    // warnOnly: true,
  },
  async rewrites() {
    return [];
  },
  async redirects() {
    return [];
  },
  // Add path aliases support
  // experimental: { appDir: true },
};

export default nextConfig;
