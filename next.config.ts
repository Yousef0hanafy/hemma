import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  // Allow Server Actions from your production domain
  // Add your production domain here to prevent CORS errors
  experimental: {
    serverActions: {
      allowedOrigins: [
        // e.g. "https://hema-lms.com",
      ],
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Upload source maps in CI only to speed up local dev
  sourcemaps: {
    disable: !process.env.CI,
  },
  // Route Sentry requests through the app to avoid ad-blockers
  tunnelRoute: "/sentry-tunnel",
  // Hides source maps from the client bundle to protect code
  hideSourceMaps: true,
  // Disable auto-instrumentation in development
  disableLogger: true,
});
