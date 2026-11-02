import { NextResponse, type NextRequest } from "next/server";
import { badRequest, getParticipant, sessionOver, unauthorised } from "@/lib/play";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { MessageRow, Pin } from "@/lib/types";

export const runtime = "nodejs";

/** Pin an AI message (text or picture) to the creation board. */
export async function POST(request: NextRequest) {
  const ctx = await getParticipant();
  if (!ctx) return unauthorised();
  if (ctx.ended) return sessionOver();

  const body = (await request.json().catch(() => ({}))) as { messageId?: string };
  if (!body.messageId) return badRequest("Which message?");

  const db = createServiceSupabase();
  const { data: message } = await db.from("messages").select("*").eq("id", body.messageId).eq("participant_id", ctx.participant.id).maybeSingle<MessageRow>();
  if (!message || message.role !== "assistant") return badRequest("You can pin the helper's messages and pictures.");
  if (message.moderation && message.moderation.ok === false) return badRequest("That one can't be pinned.");

  const { data: existing } = await db.from("pins").select("*").eq("participant_id", ctx.participant.id).order("position", { ascending: false }).limit(1);
  const position = ((existing?.[0] as Pin | undefined)?.position ?? 0) + 1;
  const { data: pin, error } = await db
    .from("pins")
    .upsert({ participant_id: ctx.participant.id, message_id: message.id, position }, { onConflict: "participant_id,message_id" })
    .select("*")
    .single<Pin>();
  if (error) throw error;
  return NextResponse.json({ pin: { id: pin.id, messageId: pin.message_id, position: pin.position } });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getParticipant();
  if (!ctx) return unauthorised();
  if (ctx.ended) return sessionOver();

  const body = (await request.json().catch(() => ({}))) as { pinId?: string };
  if (!body.pinId) return badRequest("Which pin?");
  const db = createServiceSupabase();
  const { error } = await db.from("pins").delete().eq("id", body.pinId).eq("participant_id", ctx.participant.id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
