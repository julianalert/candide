import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

// Both Supabase flows land here: PKCE (?code=) for magic links sent by this app,
// and token hash (?token_hash=&type=) for invite links.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeNext(searchParams.get("next"));

  const supabase = await createServerSupabase();
  let failed = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    failed = Boolean(error);
  } else {
    failed = true;
  }

  if (failed) return NextResponse.redirect(`${origin}/login?error=link`);
  return NextResponse.redirect(`${origin}${nextPath}`);
}

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/teacher";
  return value;
}
