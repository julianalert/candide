import { NextResponse, type NextRequest } from "next/server";
import { badRequest, getParticipant, sessionOver, unauthorised } from "@/lib/play";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

/** Mission 6: the kid's rules for the AI, injected under the safety layer as {{kidRules}}. */
export async function POST(request: NextRequest) {
  const ctx = await getParticipant();
  if (!ctx) return unauthorised();
  if (ctx.ended) return sessionOver();
  if (!ctx.mission.ai.features.includes("rulesBox")) return badRequest("This mission has no rules box.");

  const body = (await request.json().catch(() => ({}))) as { rules?: string };
  const rules = String(body.rules ?? "").slice(0, 600);
  const db = createServiceSupabase();
  const { error } = await db.from("participants").update({ kid_rules: rules }).eq("id", ctx.participant.id);
  if (error) throw error;
  return NextResponse.json({ ok: true, rules });
}
