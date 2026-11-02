import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, isValidClassCode, newClassCode, newPublicId, normaliseCode, randomCode } from "@/lib/codes";

describe("class codes", () => {
  it("are six characters without ambiguous symbols", () => {
    for (let i = 0; i < 500; i++) {
      const code = newClassCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(code).not.toMatch(/[01OI]/);
      expect(isValidClassCode(code)).toBe(true);
    }
  });

  it("use every symbol of the alphabet eventually", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) for (const ch of newClassCode()) seen.add(ch);
    expect(seen.size).toBe(CODE_ALPHABET.length);
  });

  it("normalise what a kid types", () => {
    expect(normaliseCode(" ab c-d2 3 ")).toBe("ABCD23");
    expect(isValidClassCode(normaliseCode("abcd23"))).toBe(true);
    expect(isValidClassCode("ABCD0I")).toBe(false);
    expect(isValidClassCode("ABCDE")).toBe(false);
  });

  it("public ids are twelve characters", () => {
    expect(newPublicId()).toHaveLength(12);
    expect(() => randomCode(4, "ABC")).toThrow();
  });
});
