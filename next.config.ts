import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow Server Actions to be invoked from the preview proxy
  experimental: {
    serverActions: {
      allowedOrigins: [
        "preview-chat-1e925db2-47ff-4a3f-ab8f-adc89a8867c4.space-z.ai",
        "preview-1e925db2-47ff-4a3f-ab8f-adc89a8867c4.space-z.ai",
        "*.space-z.ai",
      ],
    },
  },
};

export default nextConfig;
