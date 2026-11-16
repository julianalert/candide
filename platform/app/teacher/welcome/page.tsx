import { WelcomeForm } from "@/components/welcome-form";
import { requireAdmin } from "@/lib/teacher";
import type { School } from "@/lib/types";

export const metadata = { title: "Welcome" };

/** Shown once to a school admin, before anything else; reachable again to edit the details. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase, profile, email } = await requireAdmin();
  const { data: school } = await supabase.from("schools").select("*").eq("id", profile.school_id).maybeSingle<School>();
  return (
    <WelcomeForm
      school={school}
      displayName={profile.display_name}
      jobTitle={profile.job_title}
      email={email}
      editing={params.edit === "1" || Boolean(profile.onboarded_at)}
      error={params.error}
    />
  );
}
