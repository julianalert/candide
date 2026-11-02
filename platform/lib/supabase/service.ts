import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceKey, supabaseUrl } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS: only for the kid routes, server actions that
 *  must act across users (invites), and scripts. Never import from a client component. */
export function createServiceSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl(), supabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
