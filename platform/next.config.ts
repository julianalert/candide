import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The prompt files are read from disk at runtime, so make sure Vercel's file
  // tracing ships them with the serverless functions. Terms and missions live in the
  // database (loaded by `npm run seed`), so /terms is not needed at runtime.
  outputFileTracingIncludes: {
    "/api/play/**": ["./ai/**"],
  },
  images: {
    // Signed Supabase Storage URLs are rendered with a plain <img>, so no loader config is needed.
    unoptimized: true,
  },
};

export default nextConfig;
