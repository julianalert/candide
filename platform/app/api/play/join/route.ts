import { NextResponse, type NextRequest } from "next/server";
import { sessionIsOver } from "@/lib/caps";
import { isValidClassCode, normaliseCode } from "@/lib/codes";
import { kidCookieSecret } from "@/lib/env";
import { dedupeName } from "@/lib/format";
import { KID_COOKIE, kidCookieOptions, kidSessionExpiry, signKidSession } from "@/lib/kid-session";
import { snapshotInfo } from "@/lib/missions";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { Kid, Participant, SessionRow } from "@/lib/types";

export const runtime = "nodejs";

// Two steps, no account and no email:
//   { code }         → this week's mission and the club list (first names only)
//   { code, kidId }  → the child's participant for this week's session + signed cookie
// The same child gets the same participant if they join again in the same session, and
// their earlier weeks follow them through kid_id.

export async function POST(request: NextRequest) {
  let body: { code?: string; kidId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Type your group code." }, { status: 400 });
  }

  const code = normaliseCode(String(body.code ?? ""));
  if (!isValidClassCode(code)) return NextResponse.json({ error: "That code should be 6 letters and numbers. Check it with your teacher." }, { status: 400 });

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
    return NextResponse.json({ error: "Your group hasn't started yet. Wait for your teacher." }, { status: 409 });
  }
  const info = snapshotInfo(sessionRow.mission_snapshot);
  const week = sessionRow.week ?? info.week;

  const { data: kidRows } = await db.from("kids").select("*").eq("class_id", klass.id).is("archived_at", null).order("display_name");
  const kids = (kidRows ?? []) as Kid[];

  // Step 1: show the list.
  if (!body.kidId) {
    return NextResponse.json({ week, title: info.title, names: kids.map((kid) => ({ id: kid.id, name: kid.display_name })) });
  }

  // Step 2: the child tapped their name.
  const kid = kids.find((k) => k.id === body.kidId);
  if (!kid) return NextResponse.json({ error: "We couldn't find that name. Ask your teacher to check the list." }, { status: 404 });

  let participant: Participant | null = null;
  const { data: existing } = await db.from("participants").select("*").eq("session_id", sessionRow.id).eq("kid_id", kid.id).maybeSingle<Participant>();
  participant = existing ?? null;

  if (!participant) {
    const { data: others } = await db.from("participants").select("display_name").eq("session_id", sessionRow.id);
    const taken = new Set((others ?? []).map((p: { display_name: string }) => p.display_name));
    for (let attempt = 0; attempt < 3 && !participant; attempt++) {
      const displayName = dedupeName(kid.display_name, taken);
      const { data, error } = await db
        .from("participants")
        .insert({ session_id: sessionRow.id, kid_id: kid.id, display_name: displayName })
        .select("*")
        .single<Participant>();
      if (!error) {
        participant = data;
      } else if (error.code === "23505") {
        // Either the name is taken, or the same child joined twice at once: reuse theirs.
        const { data: raced } = await db.from("participants").select("*").eq("session_id", sessionRow.id).eq("kid_id", kid.id).maybeSingle<Participant>();
        if (raced) participant = raced;
        else taken.add(displayName);
      } else {
        throw error;
      }
    }
  }
  if (!participant) return NextResponse.json({ error: "Something went wrong joining. Try again." }, { status: 500 });

  const exp = kidSessionExpiry(new Date(sessionRow.started_at));
  const token = signKidSession({ sid: sessionRow.id, pid: participant.id, exp }, kidCookieSecret());
  const response = NextResponse.json({ displayName: participant.display_name, week, title: info.title });
  response.cookies.set(KID_COOKIE, token, kidCookieOptions(exp));
  return response;
}
