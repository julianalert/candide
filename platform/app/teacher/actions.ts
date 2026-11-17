"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { newClassCode, newPublicId } from "@/lib/codes";
import { parseRosterNames } from "@/lib/format";
import { inviteOrFindColleague, resendInvite } from "@/lib/invites";
import { isTrack, parseMission } from "@/lib/missions";
import { isDay, isIsoDate, isTime } from "@/lib/schedule";
import { removeSessionImages } from "@/lib/storage";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireAdmin, requireTeacher } from "@/lib/teacher";
import type { MissionRow } from "@/lib/types";

// Teacher mutations run as server actions with the teacher's own session, so RLS
// decides what they may touch. Only invites and storage cleanup need the service key.

/**
 * School admins create clubs and choose who runs each one: themselves, a colleague
 * already in the school, or a teacher invited by email right here.
 */
export async function createClub(formData: FormData) {
  const { supabase, userId, profile } = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const track = String(formData.get("track") ?? "");
  const termId = String(formData.get("term_id") ?? "");
  const meetsDay = String(formData.get("meets_day") ?? "");
  const meetsTime = String(formData.get("meets_time") ?? "");
  const startsOn = String(formData.get("starts_on") ?? "");
  const back = (error: string) => redirect(`/teacher/school?club_error=${encodeURIComponent(error)}#new-club`);
  if (!name) back("Give the group a name.");
  if (!isTrack(track)) back("Pick an age track.");

  const { data: term } = await supabase.from("terms").select("id").eq("id", termId).eq("published", true).maybeSingle();
  if (!term) back("Pick a term.");

  const manager = await resolveManager(formData, { userId, schoolId: profile.school_id });
  if (!manager.ok) back(manager.error);

  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase.from("classes").insert({
      school_id: profile.school_id,
      teacher_id: manager.ok ? manager.profileId : userId,
      name,
      track,
      term_id: termId,
      meets_day: isDay(meetsDay) ? meetsDay : null,
      meets_time: isTime(meetsTime) ? meetsTime : null,
      starts_on: isIsoDate(startsOn) ? startsOn : null,
      code: newClassCode(),
    });
    if (!error) {
      revalidatePath("/teacher/school");
      redirect(`/teacher/school?created=${encodeURIComponent(name)}${manager.ok && manager.invited ? "&invited_manager=1" : ""}`);
    }
    // 23505 = unique violation on the code: draw another one.
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique club code");
}

/** The manager or an admin sets when the club meets and the date its first week starts. */
export async function updateClubSchedule(formData: FormData) {
  const { supabase } = await requireTeacher();
  const classId = String(formData.get("class_id") ?? "");
  const meetsDay = String(formData.get("meets_day") ?? "");
  const meetsTime = String(formData.get("meets_time") ?? "");
  const startsOn = String(formData.get("starts_on") ?? "");
  // RLS lets only the club's manager or a school admin change it.
  const { data, error } = await supabase
    .from("classes")
    .update({ meets_day: isDay(meetsDay) ? meetsDay : null, meets_time: isTime(meetsTime) ? meetsTime : null, starts_on: isIsoDate(startsOn) ? startsOn : null })
    .eq("id", classId)
    .select("id");
  if (error) throw error;
  if (!data?.length) redirect(`/teacher/class/${classId}?schedule=denied`);
  revalidatePath(`/teacher/class/${classId}`);
  revalidatePath("/teacher/school");
  redirect(`/teacher/class/${classId}?schedule=saved`);
}

/** Admins: hand a club to another manager (or take it over). */
export async function setClubManager(formData: FormData) {
  const { supabase, userId, profile } = await requireAdmin();
  const classId = String(formData.get("class_id") ?? "");
  const manager = await resolveManager(formData, { userId, schoolId: profile.school_id });
  if (!manager.ok) redirect(`/teacher/class/${classId}?manager_error=${encodeURIComponent(manager.error)}`);
  const { error } = await supabase.from("classes").update({ teacher_id: manager.profileId }).eq("id", classId).eq("school_id", profile.school_id);
  if (error) throw error;
  revalidatePath(`/teacher/class/${classId}`);
  revalidatePath("/teacher/school");
  redirect(`/teacher/class/${classId}?manager=changed`);
}

type ManagerChoice = { ok: true; profileId: string; invited: boolean } | { ok: false; error: string };

/** manager = "me" | "invite" | a profile id from the school. */
async function resolveManager(formData: FormData, ctx: { userId: string; schoolId: string }): Promise<ManagerChoice> {
  const choice = String(formData.get("manager") ?? "me");
  if (choice === "me") return { ok: true, profileId: ctx.userId, invited: false };
  if (choice === "invite") {
    const email = String(formData.get("manager_email") ?? "");
    const name = String(formData.get("manager_name") ?? "").trim().slice(0, 60);
    if (!email.trim()) return { ok: false, error: "Type the email of the teacher who will run the group." };
    const result = await inviteOrFindColleague({ schoolId: ctx.schoolId, email, name, role: "teacher" });
    return result.ok ? { ok: true, profileId: result.profileId, invited: true } : result;
  }
  const { data: colleague } = await createServiceSupabase().from("profiles").select("id").eq("id", choice).eq("school_id", ctx.schoolId).maybeSingle();
  return colleague ? { ok: true, profileId: colleague.id, invited: false } : { ok: false, error: "Pick who runs the group." };
}

/** The admin's welcome screen: confirm the school and who they are. */
export async function saveSchoolSetup(formData: FormData) {
  const { supabase, userId, profile } = await requireAdmin();
  const schoolName = String(formData.get("school_name") ?? "").trim().slice(0, 120);
  const city = String(formData.get("city") ?? "").trim().slice(0, 80);
  const country = String(formData.get("country") ?? "").trim().toUpperCase().slice(0, 2);
  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 60);
  const jobTitle = String(formData.get("job_title") ?? "").trim().slice(0, 80);
  const editing = formData.get("editing") === "1";
  if (!schoolName || !displayName) redirect(`/teacher/welcome?error=missing${editing ? "&edit=1" : ""}`);

  // Only these fields: the school's image cap and the rest stay Candide's to set.
  const { error: schoolError } = await createServiceSupabase()
    .from("schools")
    .update({ name: schoolName, city: city || null, country: /^[A-Z]{2}$/.test(country) ? country : null })
    .eq("id", profile.school_id);
  if (schoolError) throw schoolError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: displayName, job_title: jobTitle || null, onboarded_at: profile.onboarded_at ?? new Date().toISOString() })
    .eq("id", userId);
  if (profileError) throw profileError;

  revalidatePath("/teacher", "layout");
  redirect(editing ? "/teacher/school?saved=1" : "/teacher/school?welcome=1");
}

/** Send the invite again to a colleague who hasn't accepted it. */
export async function resendColleagueInvite(formData: FormData) {
  const { profile } = await requireAdmin();
  const profileId = String(formData.get("profile_id") ?? "");
  const back = String(formData.get("back") ?? "/teacher/school");
  const result = await resendInvite(profileId, profile.school_id);
  const safeBack = back.startsWith("/teacher") ? back : "/teacher/school";
  const sep = safeBack.includes("?") ? "&" : "?";
  redirect(`${safeBack}${sep}${result.ok ? "resent=1" : `error=${encodeURIComponent(result.error ?? "Could not resend")}`}`);
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
  const email = String(formData.get("email") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 60);
  const role = formData.get("role") === "admin" ? "admin" : "teacher";
  if (!email.trim()) redirect("/teacher/school?error=Enter%20an%20email");

  const result = await inviteOrFindColleague({ schoolId: profile.school_id, email, name: displayName, role });
  if (!result.ok) redirect(`/teacher/school?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/teacher/school");
  redirect(`/teacher/school?invited=${encodeURIComponent(email.trim().toLowerCase())}`);
}
