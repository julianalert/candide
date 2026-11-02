"use server";

import { redirect } from "next/navigation";
import { appUrl } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = String(formData.get("next") ?? "/teacher");
  if (!email) redirect("/login?error=email");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Teachers are invited by their school; nobody can sign up from this form.
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    const code = /signups? not allowed|not found|otp_disabled/i.test(error.message) ? "unknown" : "failed";
    redirect(`/login?error=${code}&email=${encodeURIComponent(email)}`);
  }
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}
