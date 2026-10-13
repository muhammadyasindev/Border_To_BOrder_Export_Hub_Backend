import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
