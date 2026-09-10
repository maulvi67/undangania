import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared UI package ships raw TSX/CSS sources; Next must transpile it.
  transpilePackages: ["@wedding/ui"],
};

export default nextConfig;
