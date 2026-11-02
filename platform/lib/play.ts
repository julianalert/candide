import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionIsOver } from "./caps";
import { kidCookieSecret } from "./env";
import { KID_COOKIE, verifyKidSession } from "./kid-session";
import { parseMission, type Mission } from "./missions";
import { createServiceSupabase } from "./supabase/service";
import type { Participant, SessionRow } from "./types";

// Every /api/play/* route starts here: verify the kid cookie, then load the
// participant, its session, the class and the school in one query.

export type PlayContext = {
  participant: Participant;
  session: SessionRow;
  mission: Mission;
  classId: string;
  school: { id: string; name: string; daily_image_cap: number };
  ended: boolean;
};

type Loaded = Participant & {
  session:
    | (SessionRow & {
        class: { id: string; school_id: string; school: { id: string; name: string; daily_image_cap: number } | null } | null;
      })
    | null;
};

export async function getParticipant(): Promise<PlayContext | null> {
  const token = (await cookies()).get(KID_COOKIE)?.value;
  const kid = verifyKidSession(token, kidCookieSecret());
  if (!kid) return null;

  const db = createServiceSupabase();
  const { data, error } = await db
    .from("participants")
    .select("*, session:sessions(*, class:classes(id, school_id, school:schools(id, name, daily_image_cap)))")
    .eq("id", kid.pid)
    .maybeSingle<Loaded>();
  if (error) throw error;
  if (!data || !data.session || data.session.id !== kid.sid || !data.session.class?.school) return null;

  const { session, ...participant } = data;
  const { class: klass, ...sessionRow } = session;
  return {
    participant,
    session: sessionRow,
    mission: parseMission(sessionRow.mission_snapshot, `session ${sessionRow.id}`),
    classId: klass!.id,
    school: klass!.school!,
    ended: sessionIsOver(sessionRow),
  };
}

export function unauthorised(message = "Join a session first.") {
  return NextResponse.json({ error: message, code: "no_session" }, { status: 401 });
}

export function badRequest(message: string, code = "bad_request") {
  return NextResponse.json({ error: message, code }, { status: 400 });
}

export function sessionOver() {
  return NextResponse.json({ error: "This session has ended.", code: "ended" }, { status: 409 });
}

/** Storage path for a generated image. */
export function imagePath(sessionId: string, participantId: string, messageId: string): string {
  return `${sessionId}/${participantId}/${messageId}.png`;
}

export const IMAGE_BUCKET = "creations";
export const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

/** Sign a batch of storage paths. Returns a map path → url (missing paths are skipped). */
export async function signImagePaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const result = new Map<string, string>();
  if (!unique.length) return result;
  const db = createServiceSupabase();
  const { data, error } = await db.storage.from(IMAGE_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error) throw error;
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  }
  return result;
}
