import { appUrl } from "./env";
import { createServiceSupabase } from "./supabase/service";
import type { Profile, ProfileRole } from "./types";

// Inviting colleagues needs the service key (Supabase's admin API). Callers must
// have checked that the signed-in user is an admin of `schoolId` first.

export type InviteResult = { ok: true; profileId: string; invited: boolean } | { ok: false; error: string };

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * The profile for this email in this school, inviting the person first if they have
 * no account yet. Supabase sends the invite through Loops; the profile exists as soon
 * as the invite is created, so a club can be assigned to them before they accept.
 */
export async function inviteOrFindColleague(params: { schoolId: string; email: string; name: string; role: ProfileRole }): Promise<InviteResult> {
  const email = normaliseEmail(params.email);
  if (!looksLikeEmail(email)) return { ok: false, error: "That email address doesn't look right." };
  const db = createServiceSupabase();

  const { data: existing } = await db.from("profiles").select("*").eq("email", email).maybeSingle<Profile>();
  if (existing) {
    if (existing.school_id && existing.school_id !== params.schoolId) {
      return { ok: false, error: `${email} already uses Candide with another school. Write to hello@candideai.com and we'll sort it out.` };
    }
    if (!existing.school_id) {
      const { error } = await db.from("profiles").update({ school_id: params.schoolId, role: params.role }).eq("id", existing.id);
      if (error) throw error;
    }
    // Someone who never accepted gets the invite again; someone already in is simply assigned.
    if (!(await hasJoined(existing.id))) await sendInvite(email, params.schoolId, params.role, params.name || existing.display_name || "");
    return { ok: true, profileId: existing.id, invited: false };
  }

  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    data: { school_id: params.schoolId, role: params.role, display_name: params.name || email.split("@")[0] },
    redirectTo: `${appUrl()}/auth/callback`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, profileId: data.user.id, invited: true };
}

async function sendInvite(email: string, schoolId: string, role: ProfileRole, name: string) {
  const db = createServiceSupabase();
  const { error } = await db.auth.admin.inviteUserByEmail(email, {
    data: { school_id: schoolId, role, display_name: name || email.split("@")[0] },
    redirectTo: `${appUrl()}/auth/callback`,
  });
  if (error) throw error;
}

/** Send the invite again to someone in this school who hasn't accepted yet. */
export async function resendInvite(profileId: string, schoolId: string): Promise<{ ok: boolean; error?: string }> {
  const db = createServiceSupabase();
  const { data: profile } = await db.from("profiles").select("*").eq("id", profileId).eq("school_id", schoolId).maybeSingle<Profile>();
  if (!profile?.email) return { ok: false, error: "We couldn't find that person." };
  if (await hasJoined(profile.id)) return { ok: false, error: `${profile.email} has already joined.` };
  await sendInvite(profile.email, schoolId, profile.role, profile.display_name ?? "");
  return { ok: true };
}

/** Whether this person has accepted their invite (or signed in at least once). */
export async function hasJoined(userId: string): Promise<boolean> {
  const { data } = await createServiceSupabase().auth.admin.getUserById(userId);
  const user = data?.user;
  return Boolean(user && (user.email_confirmed_at || user.last_sign_in_at));
}

/** The ids, among these, of people who haven't accepted their invite yet. */
export async function pendingInvites(userIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(userIds)];
  const joined = await Promise.all(unique.map((id) => hasJoined(id).catch(() => true)));
  return new Set(unique.filter((_, i) => !joined[i]));
}
