import { KID_SESSION_HOURS } from "./kid-session";

export type Caps = { messages: number; images: number; imageRetriesPerPrompt: number };

/** 0..1 share of the budget still available. Shown to kids as a bar, never a number. */
export function remainingFraction(used: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(1, Math.max(0, (cap - used) / cap));
}

export function canSendMessage(messageCount: number, caps: Caps): boolean {
  return messageCount < caps.messages;
}

export function canMakeImage(imageCount: number, caps: Caps): boolean {
  return imageCount < caps.images;
}

/** "Try again" is limited per original prompt; the first image does not count as a retry. */
export function canRetryImage(imagesForPrompt: number, caps: Caps): boolean {
  return imagesForPrompt < 1 + caps.imageRetriesPerPrompt;
}

export function sessionEndTime(startedAt: Date | string): Date {
  const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  return new Date(start.getTime() + KID_SESSION_HOURS * 60 * 60 * 1000);
}

/** A session is over when the teacher ended it or three hours passed since it started. */
export function sessionIsOver(session: { started_at: string | Date; ended_at: string | Date | null }, now: Date = new Date()): boolean {
  if (session.ended_at) return true;
  return sessionEndTime(session.started_at).getTime() <= now.getTime();
}
