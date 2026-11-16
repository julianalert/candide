import { snapshotInfo } from "./missions";
import { signImagePaths } from "./play";
import { createServiceSupabase } from "./supabase/service";
import type { EarlierPin, MessageRow, Pin } from "./types";

// A child keeps the same hero all term. Everything they pinned in earlier weeks of
// the same club follows them: it shows on their board, and the AI helper sees a
// short text summary of it so week 8 knows the hero from week 3.

type EarlierParticipant = {
  id: string;
  session: { id: string; started_at: string; week: number | null; mission_snapshot: unknown } | null;
};

/** Pins from this child's other sessions in the club, oldest week first. */
export async function loadEarlierPins(kidId: string | null, currentParticipantId: string, options: { signUrls?: boolean } = {}): Promise<EarlierPin[]> {
  if (!kidId) return [];
  const db = createServiceSupabase();
  const { data: participantRows } = await db
    .from("participants")
    .select("id, session:sessions(id, started_at, week, mission_snapshot)")
    .eq("kid_id", kidId)
    .neq("id", currentParticipantId);
  const participants = ((participantRows ?? []) as unknown as EarlierParticipant[]).filter((p) => p.session);
  if (!participants.length) return [];

  const byParticipant = new Map(participants.map((p) => [p.id, p.session!]));
  const { data: pinRows } = await db.from("pins").select("*").in("participant_id", [...byParticipant.keys()]);
  const pins = (pinRows ?? []) as Pin[];
  if (!pins.length) return [];

  const { data: messageRows } = await db.from("messages").select("*").in("id", pins.map((p) => p.message_id));
  const messages = new Map(((messageRows ?? []) as MessageRow[]).map((m) => [m.id, m]));
  const urls = options.signUrls === false ? new Map<string, string>() : await signImagePaths([...messages.values()].map((m) => m.image_path ?? "").filter(Boolean));

  return pins
    .map((pin) => {
      const message = messages.get(pin.message_id);
      const session = byParticipant.get(pin.participant_id);
      if (!message || !session) return null;
      const info = snapshotInfo(session.mission_snapshot);
      return {
        sort: [info.week ?? 0, session.started_at, pin.position] as const,
        pin: {
          pinId: pin.id,
          messageId: message.id,
          week: session.week ?? info.week,
          title: info.title,
          kind: message.kind,
          content: message.content,
          imageUrl: message.image_path ? urls.get(message.image_path) ?? null : null,
        } satisfies EarlierPin,
      };
    })
    .filter((item) => item !== null)
    .sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1].localeCompare(b.sort[1]) || a.sort[2] - b.sort[2])
    .map((item) => item.pin);
}

export const EARLIER_WORK_MAX_CHARS = 2400;
const ITEM_MAX_CHARS = 500;

/** The text the AI helper sees about earlier weeks. Pictures appear as the description they were made from. */
export function earlierWorkSummary(pins: EarlierPin[], maxChars: number = EARLIER_WORK_MAX_CHARS): string {
  const lines: string[] = [];
  let used = 0;
  // Most recent weeks matter most when the budget runs out, so fill from the end.
  for (const pin of [...pins].reverse()) {
    const body = pin.content.replace(/\s+/g, " ").trim().slice(0, ITEM_MAX_CHARS);
    if (!body) continue;
    const label = `${pin.week ? `Week ${pin.week}` : "Earlier"} · ${pin.title}${pin.kind === "image" ? " (picture)" : ""}`;
    const line = `- ${label}: ${body}`;
    if (used + line.length > maxChars) break;
    lines.unshift(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}
