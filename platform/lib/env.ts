// Environment access in one place. Server-only values throw when missing so a
// misconfigured deployment fails loudly on the first request that needs them.

export function supabaseUrl(): string {
  return required(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return required(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function supabaseServiceKey(): string {
  return required(process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_KEY");
}

export function kidCookieSecret(): string {
  return required(process.env.KID_COOKIE_SECRET, "KID_COOKIE_SECRET");
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Host shown to kids on the projector, e.g. "app.candideai.com/join". */
export function joinUrlForDisplay(): string {
  return appUrl().replace(/^https?:\/\//, "") + "/join";
}

export function isMockAi(): boolean {
  return process.env.AI_MOCK === "1";
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
