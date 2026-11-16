"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newClassCode, newPublicId } from "@/lib/codes";
import { appUrl } from "@/lib/env";
import { parseRosterNames } from "@/lib/format";
import { isTrack, parseMission } from "@/lib/missions";
import { removeSessionImages } from "@/lib/storage";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireAdmin, requireTeacher } from "@/lib/teacher";
import type { MissionRow } from "@/lib/types";

// Teacher mutations run as server actions with the teacher's own session, so RLS
// decides what they may touch. Only invites and storage cleanup need the service key.

export async function createClass(formData: FormData) {
  const { supabase, userId, profile } = await requireTeacher();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const track = String(formData.get("track") ?? "");
  const termId = String(formData.get("term_id") ?? "");
  if (!name || !isTrack(track) || !termId) redirect("/teacher?error=class");

  const { data: term } = await supabase.from("terms").select("id").eq("id", termId).eq("published", true).maybeSingle();
  if (!term) redirect("/teacher?error=class");

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from("classes")
      .insert({ school_id: profile.school_id, teacher_id: userId, name, track, term_id: termId, code: newClassCode() })
      .select("id")
      .single();
    if (!error) {
      revalidatePath("/teacher");
      redirect(`/teacher/class/${data.id}`);
    }
    // 23505 = unique violation on the code: draw another one.
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique club code");
}

/** Add children to a club list: one first name per line (or separated by commas). */
export async function addKids(formData: FormData) {
  const { supabase } = await requireTeacher();
  const classId = String(formData.get("class_id") ?? "");
  const names = parseRosterNames(String(formData.get("names") ?? ""));
  if (!names.length) redirect(`/teacher/class/${classId}?error=names`);

  const { data: existingRows } = await supabase.from("kids").select("display_name").eq("class_id", classId).is("archived_at", null);
  const existing = new Set((existingRows ?? []).map((k: { display_name: string }) => k.display_name.toLowerCase()));
  const fresh = names.filter((name) => !existing.has(name.toLowerCase()));
  const skipped = names.length - fresh.length;

  for (const name of fresh) {
    const { error } = await supabase.from("kids").insert({ class_id: classId, display_name: name });
    // 23505: someone added the same name a moment ago. Anything else is a real problem.
    if (error && error.code !== "23505") throw error;
  }
  revalidatePath(`/teacher/class/${classId}`);
  redirect(`/teacher/class/${classId}?added=${fresh.length}${skipped ? `&skipped=${skipped}` : ""}`);
}

/** Take a child off the list. Their work stays in the galleries. */
export async function removeKid(formData: FormData) {
  const { supabase } = await requireTeacher();
  const classId = String(formData.get("class_id") ?? "");
  const kidId = String(formData.get("kid_id") ?? "");
  const { error } = await supabase.from("kids").update({ archived_at: new Date().toISOString() }).eq("id", kidId).eq("class_id", classId);
  if (error) throw error;
  revalidatePath(`/teacher/class/${classId}`);
}

export async function startSession(formData: FormData) {
  const { supabase } = await requireTeacher();
  const classId = String(formData.get("class_id") ?? "");
  const week = Number(formData.get("week"));

  const { data: klass } = await supabase.from("classes").select("id, term_id").eq("id", classId).maybeSingle<{ id: string; term_id: string }>();
  if (!klass || !Number.isInteger(week)) redirect("/teacher");

  const { data: missionRow } = await supabase
    .from("missions")
    .select("*")
    .eq("term_id", klass.term_id)
    .eq("week", week)
    .eq("published", true)
    .maybeSingle<MissionRow>();
  if (!missionRow) redirect(`/teacher/class/${classId}`);
  const mission = parseMission(missionRow.json, missionRow.id);

  const teacherInputs: Record<string, string> = {};
  for (const input of mission.teacherInputs) {
    const value = String(formData.get(`input_${input.key}`) ?? "").trim().slice(0, 200);
    if (!value) redirect(`/teacher/class/${classId}/week/${week}?error=inputs`);
    teacherInputs[input.key] = value;
  }

  // Kids join by club code, so a club has one live session at a time.
  await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("class_id", classId).is("ended_at", null);

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      class_id: classId,
      term_id: klass.term_id,
      week: mission.week,
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
