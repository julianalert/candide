import { NextResponse, type NextRequest } from "next/server";
import { assembleSystemPrompt, buildHistory, streamChat } from "@/lib/ai";
import { canSendMessage } from "@/lib/caps";
import { moderate, NEUTRAL_REPLACEMENT, SOFT_BLOCK_MESSAGE } from "@/lib/moderation";
import { badRequest, getParticipant, sessionOver, unauthorised } from "@/lib/play";
import { toPlayMessage } from "@/lib/play-state";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { MessageRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The whole chat pipeline, in order:
// participant → caps → input moderation → system prompt → Claude (streamed) → output moderation → store.
// The response is newline-delimited JSON events so the client can show tokens as they arrive.

export async function POST(request: NextRequest) {
  const ctx = await getParticipant();
  if (!ctx) return unauthorised();
  if (ctx.ended) return sessionOver();

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = String(body.text ?? "").trim().slice(0, 1500);
  if (!text) return badRequest("Type something first.");

  const { participant, session, mission } = ctx;
  if (!canSendMessage(participant.message_count, mission.ai.caps)) {
    return NextResponse.json({ error: "You've used all your messages for this mission. Time to pin your best work!", code: "cap" }, { status: 429 });
  }

  const db = createServiceSupabase();
  const verdict = await moderate(text, { mission, stage: "input" });

  const { data: userRow, error: insertError } = await db
    .from("messages")
    .insert({ participant_id: participant.id, role: "user", kind: "text", content: text, moderation: verdict })
    .select("*")
    .single<MessageRow>();
  if (insertError) throw insertError;
  // Blocked attempts count too, so a kid cannot spend the whole lesson probing the classifier.
  await db.rpc("bump_message_count", { p_participant: participant.id });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const noUrls = new Map<string, string>();
      try {
        send({ type: "start", userMessage: toPlayMessage(userRow, noUrls) });

        if (!verdict.ok) {
          send({ type: "blocked", message: SOFT_BLOCK_MESSAGE });
          controller.close();
          return;
        }

        const { data: priorRows } = await db
          .from("messages")
          .select("role, kind, content, moderation")
          .eq("participant_id", participant.id)
          .in("role", ["user", "assistant"])
          .lt("created_at", userRow.created_at)
          .order("created_at", { ascending: false })
          .limit(40);
        const prior = ((priorRows ?? []) as Pick<MessageRow, "role" | "kind" | "content" | "moderation">[])
          .reverse()
          .map((m) => ({ role: m.role as "user" | "assistant", kind: m.kind, content: m.content, blocked: m.moderation?.ok === false }));
        const history = buildHistory([...prior, { role: "user", kind: "text", content: text, blocked: false }]);
        const system = assembleSystemPrompt(mission, session.teacher_inputs, participant.kid_rules ?? "");

        const result = await streamChat({
          system,
          history,
          onDelta: (delta) => send({ type: "delta", text: delta }),
        });

        let finalText = result.text.trim();
        let moderation: MessageRow["moderation"] = { ok: true, stage: "output" };
        if (result.refused || !finalText) {
          finalText = NEUTRAL_REPLACEMENT;
          moderation = { ok: false, reason: result.refused ? "model_refusal" : "empty_reply", stage: "output" };
        } else {
          const outVerdict = await moderate(finalText, { mission, stage: "output" });
          if (!outVerdict.ok) {
            finalText = NEUTRAL_REPLACEMENT;
            moderation = outVerdict;
          }
        }

        const { data: assistantRow, error } = await db
          .from("messages")
          .insert({ participant_id: participant.id, role: "assistant", kind: "text", content: finalText, moderation })
          .select("*")
          .single<MessageRow>();
        if (error) throw error;

        send({ type: "done", message: toPlayMessage(assistantRow, noUrls), replaced: moderation.ok === false });
      } catch (error) {
        console.error("play/message failed", error);
        send({ type: "error", message: "The helper got stuck. Try sending that again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
