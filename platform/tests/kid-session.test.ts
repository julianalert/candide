import { describe, expect, it } from "vitest";
import { kidSessionExpiry, signKidSession, verifyKidSession } from "@/lib/kid-session";

const secret = "test-secret-please-rotate";

describe("kid session cookie", () => {
  const session = { sid: "session-1", pid: "participant-1", exp: Date.now() + 60_000 };

  it("round-trips", () => {
    const token = signKidSession(session, secret);
    expect(verifyKidSession(token, secret)).toEqual(session);
  });

  it("rejects a tampered payload", () => {
    const token = signKidSession(session, secret);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...session, pid: "someone-else" })).toString("base64url");
    expect(verifyKidSession(`${forged}.${sig}`, secret)).toBeNull();
    expect(verifyKidSession(`${body}.${sig.slice(1)}x`, secret)).toBeNull();
  });

  it("rejects the wrong secret, garbage and missing cookies", () => {
    const token = signKidSession(session, secret);
    expect(verifyKidSession(token, "other")).toBeNull();
    expect(verifyKidSession("not-a-token", secret)).toBeNull();
    expect(verifyKidSession(undefined, secret)).toBeNull();
  });

  it("expires three hours after the session start", () => {
    const start = new Date("2026-10-15T09:00:00Z");
    const exp = kidSessionExpiry(start);
    expect(exp - start.getTime()).toBe(3 * 60 * 60 * 1000);
    const token = signKidSession({ ...session, exp }, secret);
    expect(verifyKidSession(token, secret, exp - 1)).not.toBeNull();
    expect(verifyKidSession(token, secret, exp)).toBeNull();
  });
});
