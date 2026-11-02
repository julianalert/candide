import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { rewriteImagePrompt } from "@/lib/ai";
import { canMakeImage, canRetryImage } from "@/lib/caps";
import { getImageProvider, ImageProviderError } from "@/lib/image";
import { imageEnabled } from "@/lib/missions";
import { moderate, SOFT_BLOCK_MESSAGE } from "@/lib/moderation";
import { badRequest, getParticipant, IMAGE_BUCKET, imagePath, sessionOver, signImagePaths, unauthorised } from "@/lib/play";
import { remainingFor, toPlayMessage } from "@/lib/play-state";
import { createServiceSupabase } from "@/lib/supabase/service";
import type { MessageRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Image pipeline: caps (kid, retries per prompt, school per day) → input moderation →
// Claude rewrites the kid's words into a safe prompt with the style preset → provider → storage.

export async function POST(request: NextRequest) {
  const ctx = await getParticipant();
  if (!ctx) return unauthorised();
  if (ctx.ended) return sessionOver();
  const { participant, session, mission, school } = ctx;
  if (!imageEnabled(mission)) return badRequest("This mission is chat only.");

  const body = (await request.json().catch(() => ({}))) as { text?: string; retryOf?: string };
  const db = createServiceSupabase();

  // Resolve the kid's prompt: new text, or the original request behind a "Try again".
  let userRow: MessageRow | null = null;
  let text = String(body.text ?? "").trim().slice(0, 600);
  if (body.retryOf) {
    const { data: original } = await db
      .from("messages")
      .select("*")
      .eq("id", body.retryOf)
      .eq("participant_id", participant.id)
      .eq("role", "user")
      .eq("kind", "image")
      .maybeSingle<MessageRow>();
    if (!original) return badRequest("We couldn't find that picture request.");
    const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("parent_id", original.id).eq("role", "assistant");
    if (!canRetryImage(count ?? 0, mission.ai.caps)) {
      return NextResponse.json({ error: "That picture has had all its tries. Change the words and ask for a new one.", code: "retry_cap" }, { status: 429 });
    }
    userRow = original;
    text = original.content;
  }
  if (!text) return badRequest("Describe the picture you want first.");

  if (!canMakeImage(participant.image_count, mission.ai.caps)) {
    return NextResponse.json({ error: "You've made all your pictures for this mission. Pin your favourite!", code: "cap" }, { status: 429 });
  }
  const { data: todayCount } = await db.rpc("school_images_today", { p_school: school.id });
  if ((todayCount ?? 0) >= school.daily_image_cap) {
    return NextResponse.json({ error: "Pictures are paused for today. Keep going with words!", code: "school_cap" }, { status: 429 });
  }

  // A brand-new request is moderated and stored; a retry reuses the already-approved original.
  if (!userRow) {
    const verdict = await moderate(text, { mission, stage: "input" });
    const { data, error } = await db
      .from("messages")
      .insert({ participant_id: participant.id, role: "user", kind: "image", content: text, moderation: verdict })
      .select("*")
      .single<MessageRow>();
    if (error) throw error;
    userRow = data;
    if (!verdict.ok) return NextResponse.json({ blocked: true, message: SOFT_BLOCK_MESSAGE, userMessage: toPlayMessage(userRow, new Map()) });
  }

  const style = mission.ai.imageStyle === "realistic" ? "realistic" : "illustrated";
  const rewrite = await rewriteImagePrompt({ text, mission, style });
  if (!rewrite.ok || !rewrite.prompt.trim()) {
    if (!body.retryOf) {
      await db.from("messages").update({ moderation: { ok: false, reason: "image_rewrite", stage: "image" } }).eq("id", userRow.id);
    }
    return NextResponse.json({
      blocked: true,
      message: rewrite.reason || SOFT_BLOCK_MESSAGE,
      userMessage: body.retryOf ? undefined : toPlayMessage({ ...userRow, moderation: { ok: false, reason: "image_rewrite", stage: "image" } }, new Map()),
    });
  }

  let png: Buffer;
  try {
    png = await getImageProvider().generate(rewrite.prompt, style);
  } catch (error) {
    console.error("image provider failed", error);
    const status = error instanceof ImageProviderError && error.status === 400 ? 422 : 502;
    return NextResponse.json({ error: "The picture machine is having a rest. Try again in a moment, or change the words.", code: "provider" }, { status });
  }

  const messageId = randomUUID();
  const path = imagePath(session.id, participant.id, messageId);
  const { error: uploadError } = await db.storage.from(IMAGE_BUCKET).upload(path, png, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;

  const { data: assistantRow, error: insertError } = await db
    .from("messages")
    .insert({ id: messageId, participant_id: participant.id, parent_id: userRow.id, role: "assistant", kind: "image", content: rewrite.prompt, image_path: path, moderation: { ok: true, stage: "image" } })
    .select("*")
    .single<MessageRow>();
  if (insertError) throw insertError;

  const { data: newCount } = await db.rpc("bump_image_count", { p_participant: participant.id });
  const urls = await signImagePaths([path]);

  return NextResponse.json({
    userMessage: body.retryOf ? undefined : toPlayMessage(userRow, new Map()),
    message: toPlayMessage(assistantRow, urls),
    remaining: remainingFor(ctx, { imageCount: typeof newCount === "number" ? newCount : participant.image_count + 1 }),
  });
}
