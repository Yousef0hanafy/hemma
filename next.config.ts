import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          // Directives that can't break scripts/styles; a full CSP needs nonces.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
        ],
      },
      {
        // Browsers must always revalidate the service worker so fixes ship
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
  // Allow Server Actions from your production domain
  // Add your production domain here to prevent CORS errors
  experimental: {
    serverActions: {
      // Imports upload files through a Server Action (default limit is 1 MB).
      // Vercel caps function request bodies at 4.5 MB anyway.
      bodySizeLimit: "4.5mb",
      allowedOrigins: process.env.NEXTAUTH_URL
        ? [new URL(process.env.NEXTAUTH_URL).host, "*.vercel.app", "localhost:3000"]
        : ["localhost:3000"],
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  
  // دمج خيارات الـ sourcemaps في مكان واحد لتجنب التكرار
  sourcemaps: {
    disable: !process.env.CI,
    deleteSourcemapsAfterUpload: true,
  },
  
  // Route Sentry requests through the app to avoid ad-blockers
  tunnelRoute: "/sentry-tunnel",
  // Disable auto-instrumentation in development
  disableLogger: true,
});