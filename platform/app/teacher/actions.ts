"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newClassCode, newPublicId } from "@/lib/codes";
import { appUrl } from "@/lib/env";
import { parseMission } from "@/lib/missions";
import { removeSessionImages } from "@/lib/storage";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireAdmin, requireTeacher } from "@/lib/teacher";
import type { MissionRow } from "@/lib/types";

// Teacher mutations run as server actions with the teacher's own session, so RLS
// decides what they may touch. Only invites and storage cleanup need the service key.

export async function createClass(formData: FormData) {
  const { supabase, userId, profile } = await requireTeacher();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const yearGroup = Number(formData.get("year_group"));
  if (!name || !Number.isInteger(yearGroup) || yearGroup < 1 || yearGroup > 13) redirect("/teacher?error=class");

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from("classes")
      .insert({ school_id: profile.school_id, teacher_id: userId, name, year_group: yearGroup, code: newClassCode() })
      .select("id")
      .single();
    if (!error) {
      revalidatePath("/teacher");
      redirect(`/teacher/class/${data.id}`);
    }
    // 23505 = unique violation on the code: draw another one.
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique class code");
}

export async function startSession(formData: FormData) {
  const { supabase } = await requireTeacher();
  const classId = String(formData.get("class_id") ?? "");
  const missionId = String(formData.get("mission_id") ?? "");

  const { data: klass } = await supabase.from("classes").select("id").eq("id", classId).maybeSingle();
  if (!klass) redirect("/teacher");

  const { data: missionRow } = await supabase.from("missions").select("*").eq("id", missionId).eq("published", true).maybeSingle<MissionRow>();
  if (!missionRow) redirect(`/teacher/class/${classId}/missions`);
  const mission = parseMission(missionRow.json, missionRow.id);

  const teacherInputs: Record<string, string> = {};
  for (const input of mission.teacherInputs) {
    const value = String(formData.get(`input_${input.key}`) ?? "").trim().slice(0, 200);
    if (!value) redirect(`/teacher/class/${classId}/missions/${missionId}?error=inputs`);
    teacherInputs[input.key] = value;
  }

  // Kids join by class code, so a class has one live session at a time.
  await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("class_id", classId).is("ended_at", null);

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      class_id: classId,
      mission_id: mission.id,
      mission_version: missionRow.version,
      mission_snapshot: mission,
      teacher_inputs: teacherInputs,
      public_id: newPublicId(),
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath(`/teacher/class/${classId}`);
  redirect(`/teacher/session/${session.id}`);
}

export async function endSession(sessionId: string) {
  const { supabase } = await requireTeacher();
  const { error } = await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId).is("ended_at", null);
  if (error) throw error;
  revalidatePath(`/teacher/session/${sessionId}`);
  revalidatePath(`/teacher/session/${sessionId}/gallery`);
}

/** School admins only. Cascades through participants, messages and pins; then clears the images. */
export async function deleteSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  const sessionId = String(formData.get("session_id") ?? "");
  const { data, error } = await supabase.from("sessions").delete().eq("id", sessionId).select("id");
  if (error) throw error;
  if (data?.length) await removeSessionImages(createServiceSupabase(), sessionId);
  revalidatePath("/teacher/school");
  redirect("/teacher/school?deleted=1");
}

export async function inviteTeacher(formData: FormData) {
  const { profile } = await requireAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 60);
  const role = formData.get("role") === "admin" ? "admin" : "teacher";
  if (!email) redirect("/teacher/school?error=Enter%20an%20email");

  const service = createServiceSupabase();
  const { error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { school_id: profile.school_id, role, display_name: displayName || email.split("@")[0] },
    redirectTo: `${appUrl()}/auth/callback`,
  });
  if (error) redirect(`/teacher/school?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/teacher/school");
  redirect(`/teacher/school?invited=${encodeURIComponent(email)}`);
}
