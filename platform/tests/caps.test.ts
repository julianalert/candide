import { describe, expect, it } from "vitest";
import { canMakeImage, canRetryImage, canSendMessage, remainingFraction, sessionIsOver } from "@/lib/caps";
import { dedupeName, cleanFirstName } from "@/lib/format";

const caps = { messages: 40, images: 8, imageRetriesPerPrompt: 3 };

describe("caps", () => {
  it("message cap", () => {
    expect(canSendMessage(0, caps)).toBe(true);
    expect(canSendMessage(39, caps)).toBe(true);
    expect(canSendMessage(40, caps)).toBe(false);
  });

  it("image cap", () => {
    expect(canMakeImage(7, caps)).toBe(true);
    expect(canMakeImage(8, caps)).toBe(false);
    expect(canMakeImage(0, { ...caps, images: 0 })).toBe(false);
  });

  it("retries per prompt: the first image plus three retries", () => {
    expect(canRetryImage(1, caps)).toBe(true);
    expect(canRetryImage(3, caps)).toBe(true);
    expect(canRetryImage(4, caps)).toBe(false);
    expect(canRetryImage(1, { ...caps, imageRetriesPerPrompt: 0 })).toBe(false);
  });

  it("remaining fraction is shown as a bar between 0 and 1", () => {
    expect(remainingFraction(0, 40)).toBe(1);
    expect(remainingFraction(20, 40)).toBe(0.5);
    expect(remainingFraction(41, 40)).toBe(0);
    expect(remainingFraction(0, 0)).toBe(0);
  });

  it("a session is over when ended or three hours old", () => {
    const start = "2026-10-15T09:00:00Z";
    expect(sessionIsOver({ started_at: start, ended_at: null }, new Date("2026-10-15T10:00:00Z"))).toBe(false);
    expect(sessionIsOver({ started_at: start, ended_at: null }, new Date("2026-10-15T12:00:00Z"))).toBe(true);
    expect(sessionIsOver({ started_at: start, ended_at: "2026-10-15T09:45:00Z" }, new Date("2026-10-15T09:50:00Z"))).toBe(true);
  });
});

describe("badge names", () => {
  it("appends a number when a first name is taken", () => {
    expect(dedupeName("Sam", new Set())).toBe("Sam");
    expect(dedupeName("Sam", new Set(["Sam"]))).toBe("Sam 2");
    expect(dedupeName("Sam", new Set(["Sam", "Sam 2"]))).toBe("Sam 3");
  });

  it("keeps a first name a first name", () => {
    expect(cleanFirstName("  sam smith ")).toBe("Sam");
    expect(cleanFirstName("zoë-1!")).toBe("Zoë-");
    expect(cleanFirstName("<script>")).toBe("Script");
    expect(cleanFirstName("   ")).toBe("");
  });
});
