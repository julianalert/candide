import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import type { Profile } from "./types";

export type TeacherContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  userId: string;
  email: string | null;
  profile: Profile | null;
};

/** The signed-in teacher, or a redirect to the login page. */
export async function getTeacher(): Promise<TeacherContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  return { supabase, userId: user.id, email: user.email ?? null, profile: profile ?? null };
}

/** Like getTeacher, but the profile must exist and belong to a school. */
export async function requireTeacher(): Promise<TeacherContext & { profile: Profile & { school_id: string } }> {
  const ctx = await getTeacher();
  if (!ctx.profile?.school_id) redirect("/teacher/no-school");
  return ctx as TeacherContext & { profile: Profile & { school_id: string } };
}

export async function requireAdmin() {
  const ctx = await requireTeacher();
  if (ctx.profile.role !== "admin" && !ctx.profile.is_superadmin) redirect("/teacher");
  return ctx;
}
