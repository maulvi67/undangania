import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// Authenticated, customer-specific, and provider callback traffic must never be
// stored by a shared cache (browser, edge, or proxy). Public invitation pages are
// deliberately absent: they are unauthenticated and invalidated at the origin.
const privateRoutePatterns = [
  "/api/auth/:path*",
  "/api/editor/:path*",
  "/api/health",
  "/dashboard/:path*",
  "/tamu/:path*",
  "/editor/:path*",
  "/checkout/:path*",
  "/pesanan/:path*",
];

const nextConfig: NextConfig = {
  // The container image runs the traced server bundle from `.next/standalone`.
  output: "standalone",
  // The shared UI package ships raw TSX/CSS sources; Next must transpile it.
  transpilePackages: ["@wedding/ui"],
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      ...privateRoutePatterns.map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "no-store" }],
      })),
    ];
  },
};

export default nextConfig;
