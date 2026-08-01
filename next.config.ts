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