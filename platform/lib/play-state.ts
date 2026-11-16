import { remainingFraction } from "./caps";
import { appUrl } from "./env";
import { loadEarlierPins } from "./kid-work";
import { kidView } from "./missions";
import { signImagePaths, type PlayContext } from "./play";
import { createServiceSupabase } from "./supabase/service";
import type { MessageRow, Pin, PlayMessage, PlayState } from "./types";

export function toPlayMessage(row: MessageRow, urls: Map<string, string>): PlayMessage {
  return {
    id: row.id,
    role: row.role,
    kind: row.kind,
    content: row.content,
    imageUrl: row.image_path ? urls.get(row.image_path) ?? null : null,
    blocked: row.moderation ? row.moderation.ok === false && row.role === "user" : false,
    parentId: row.parent_id,
    createdAt: row.created_at,
  };
}

/** Everything the kid's browser needs: this week's mission (kid view), transcript, board, earlier weeks, remaining caps. */
export async function buildPlayState(ctx: PlayContext): Promise<PlayState> {
  const db = createServiceSupabase();
  const [{ data: messageRows }, { data: pinRows }, earlier] = await Promise.all([
    db.from("messages").select("*").eq("participant_id", ctx.participant.id).in("role", ["user", "assistant"]).order("created_at"),
    db.from("pins").select("*").eq("participant_id", ctx.participant.id).order("position"),
    loadEarlierPins(ctx.participant.kid_id, ctx.participant.id),
  ]);
  const messages = (messageRows ?? []) as MessageRow[];
  const pins = (pinRows ?? []) as Pin[];
  const urls = await signImagePaths(messages.map((m) => m.image_path ?? "").filter(Boolean));

  return {
    participant: { id: ctx.participant.id, displayName: ctx.participant.display_name },
    mission: kidView(ctx.mission, ctx.track, ctx.session.teacher_inputs),
    termTitle: ctx.termTitle,
    earlier,
    kidRules: ctx.participant.kid_rules ?? "",
    messages: messages.map((row) => toPlayMessage(row, urls)),
    pins: pins.map((pin) => ({ id: pin.id, messageId: pin.message_id, position: pin.position })),
    remaining: remainingFor(ctx),
    ended: ctx.ended,
    galleryUrl: `${appUrl()}/g/${ctx.session.public_id}`,
  };
}

export function remainingFor(ctx: PlayContext, overrides: { messageCount?: number; imageCount?: number } = {}) {
  const caps = ctx.mission.ai.caps;
  return {
    messages: remainingFraction(overrides.messageCount ?? ctx.participant.message_count, caps.messages),
    images: remainingFraction(overrides.imageCount ?? ctx.participant.image_count, caps.images),
  };
}
