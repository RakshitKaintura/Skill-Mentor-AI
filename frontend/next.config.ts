import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // 1. Optimized Image Configuration
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // 2. TypeScript Configuration
  // Keep this only if you must skip type checks during production builds
  typescript: {
    ignoreBuildErrors: false, 
  },

  // NOTE: The 'eslint' block was removed here. 
  // Next.js 16 no longer supports it in this file.
};

export default nextConfig;