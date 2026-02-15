import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // ── Remote image domains ────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.kie.ai" },
      { protocol: "https", hostname: "**.claid.ai" },
    ],
  },

  // ── CDN / edge cache headers ────────────────────────────────────────────
  async headers() {
    return [
      {
        // Immutable cache for video and image assets
        source: "/(.*)\\.(:?mp4|webm|mov|png|jpg|jpeg|webp|gif|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          {
            key: "CDN-Cache-Control",
            value: "public, max-age=31536000",
          },
        ],
      },
      {
        // Short cache for API responses with stale-while-revalidate
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=10, stale-while-revalidate=30",
          },
        ],
      },
      {
        // Security headers for all routes
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
