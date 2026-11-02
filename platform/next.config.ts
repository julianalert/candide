import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The prompt files and mission JSON are read from disk at runtime, so make
  // sure Vercel's file tracing ships them with the serverless functions.
  outputFileTracingIncludes: {
    "/api/play/**": ["./ai/**", "./missions/**"],
    "/teacher/**": ["./missions/**"],
  },
  images: {
    // Signed Supabase Storage URLs are rendered with a plain <img>, so no loader config is needed.
    unoptimized: true,
  },
};

export default nextConfig;
