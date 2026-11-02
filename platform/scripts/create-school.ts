import "./_env";
import { createClient } from "@supabase/supabase-js";

// Candide staff: create a school and invite its first admin.
//   npm run create-school -- --name "Doha British School" --country QA --admin-email head@school.qa --admin-name "Ms Khan"

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY");
  const name = arg("name");
  const email = arg("admin-email");
  if (!name || !email) throw new Error("Usage: --name <school> --admin-email <email> [--admin-name <name>] [--country <ISO>] [--daily-image-cap <n>]");

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: school, error } = await db
    .from("schools")
    .insert({ name, country: arg("country") ?? null, daily_image_cap: Number(arg("daily-image-cap") ?? 2000) })
    .select()
    .single();
  if (error) throw error;
  console.log(`School created: ${school.id} (${school.name})`);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { data: invite, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    data: { school_id: school.id, role: "admin", display_name: arg("admin-name") ?? email.split("@")[0] },
    redirectTo: `${appUrl}/auth/callback`,
  });
  if (inviteError) throw inviteError;
  console.log(`Invite sent to ${email} (user ${invite.user.id}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
