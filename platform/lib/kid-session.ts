import { createHmac, timingSafeEqual } from "node:crypto";

// A kid never has an account. After joining they hold one signed cookie bound to a
// session id and a participant id, valid for three hours from the session start.

export const KID_COOKIE = "candide_kid";
export const KID_SESSION_HOURS = 3;

export type KidSession = {
  /** session id */
  sid: string;
  /** participant id */
  pid: string;
  /** expiry, unix ms */
  exp: number;
};

export function signKidSession(session: KidSession, secret: string): string {
  const body = base64url(Buffer.from(JSON.stringify(session), "utf8"));
  return `${body}.${hmac(body, secret)}`;
}

export function verifyKidSession(token: string | undefined, secret: string, now: number = Date.now()): KidSession | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = hmac(body, secret);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isKidSession(parsed)) return null;
  if (parsed.exp <= now) return null;
  return parsed;
}

export function kidSessionExpiry(startedAt: Date): number {
  return startedAt.getTime() + KID_SESSION_HOURS * 60 * 60 * 1000;
}

export function kidCookieOptions(exp: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp),
  };
}

function isKidSession(value: unknown): value is KidSession {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.sid === "string" && typeof v.pid === "string" && typeof v.exp === "number";
}

function hmac(body: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(body).digest());
}

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}
