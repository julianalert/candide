import { NextResponse, type NextRequest } from "next/server";
import { sessionIsOver } from "@/lib/caps";
import { isValidClassCode, normaliseCode } from "@/lib/codes";
import { kidCookieSecret } from "@/lib/env";
import { cleanFirstName, dedupeName } from "@/lib/format";
import { KID_COOKIE, kidCookieOptions, kidSessionExpiry, signKidSession } from "@/lib/kid-session";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { Participant, SessionRow } from "@/lib/types";

export const runtime = "nodejs";

// Class code + first name → participant + signed cookie. No account, no email.
export async function POST(request: NextRequest) {
  let body: { code?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Type your class code and your first name." }, { status: 400 });
  }

  const code = normaliseCode(String(body.code ?? ""));
  const name = cleanFirstName(String(body.name ?? ""));
  if (!isValidClassCode(code)) return NextResponse.json({ error: "That code should be 6 letters and numbers. Check it with your teacher." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Type your first name so your class knows whose work is whose." }, { status: 400 });

  const db = createServiceSupabase();
  const { data: klass } = await db.from("classes").select("id").eq("code", code).maybeSingle<{ id: string }>();
  if (!klass) return NextResponse.json({ error: "That code isn't right. Check it with your teacher." }, { status: 404 });

  const { data: sessionRow } = await db
    .from("sessions")
    .select("*")
    .eq("class_id", klass.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<SessionRow>();
  if (!sessionRow || sessionIsOver(sessionRow)) {
    return NextResponse.json({ error: "That code isn't live right now, ask your teacher." }, { status: 409 });
  }

  const { data: existing } = await db.from("participants").select("display_name").eq("session_id", sessionRow.id);
  const taken = new Set((existing ?? []).map((p: { display_name: string }) => p.display_name));

  let participant: Participant | null = null;
  for (let attempt = 0; attempt < 3 && !participant; attempt++) {
    const displayName = dedupeName(name, taken);
    const { data, error } = await db.from("participants").insert({ session_id: sessionRow.id, display_name: displayName }).select("*").single<Participant>();
    if (!error) participant = data;
    else if (error.code === "23505") taken.add(displayName);
    else throw error;
  }
  if (!participant) return NextResponse.json({ error: "Something went wrong joining. Try again." }, { status: 500 });

  const exp = kidSessionExpiry(new Date(sessionRow.started_at));
  const token = signKidSession({ sid: sessionRow.id, pid: participant.id, exp }, kidCookieSecret());
  const response = NextResponse.json({ displayName: participant.display_name, missionTitle: sessionRow.mission_snapshot.title });
  response.cookies.set(KID_COOKIE, token, kidCookieOptions(exp));
  return response;
}
