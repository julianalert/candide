import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Teacher pages and the login page only. Kid routes use their own cookie and never touch Supabase auth.
  matcher: ["/teacher/:path*", "/login"],
};
