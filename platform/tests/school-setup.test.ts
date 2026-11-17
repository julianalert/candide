import { describe, expect, it } from "vitest";
import { parentClubDescription } from "@/lib/club-copy";
import { looksLikeEmail, normaliseEmail } from "@/lib/invites";
import { isDay, isIsoDate, isTime, meetsLabel, shortDay, weekDate } from "@/lib/schedule";

describe("club schedule", () => {
  it("validates days, times and dates", () => {
    expect(isDay("Tuesday")).toBe(true);
    expect(isDay("tuesday")).toBe(false);
    expect(isTime("14:05")).toBe(true);
    expect(isTime("24:00")).toBe(false);
    expect(isIsoDate("2027-01-11")).toBe(true);
    expect(isIsoDate("2027-02-30")).toBe(false);
  });

  it("labels when a club meets", () => {
    expect(meetsLabel("Tuesday", "14:00")).toBe("Tuesdays · 14:00");
    expect(meetsLabel("Tuesday", null)).toBe("Tuesdays");
    expect(meetsLabel(null, null)).toBe("");
  });

  it("puts week 1 on the club's first meeting day on or after its start date", () => {
    // 11 January 2027 is a Monday.
    expect(shortDay(weekDate("2027-01-11", "Tuesday", 1))).toBe("Tue 12 Jan");
    expect(shortDay(weekDate("2027-01-11", "Monday", 1))).toBe("Mon 11 Jan");
    expect(shortDay(weekDate("2027-01-11", "Sunday", 1))).toBe("Sun 17 Jan");
    expect(shortDay(weekDate("2027-01-11", "Tuesday", 12))).toBe("Tue 30 Mar");
  });

  it("falls back to the start date without a meeting day, and to nothing without a start", () => {
    expect(shortDay(weekDate("2027-01-11", null, 2))).toBe("Mon 18 Jan");
    expect(weekDate(null, "Tuesday", 1)).toBeNull();
    expect(weekDate("2027-01-11", "Tuesday", 0)).toBeNull();
  });
});

describe("invites", () => {
  it("normalises and checks email addresses", () => {
    expect(normaliseEmail("  Ms.Khan@School.QA ")).toBe("ms.khan@school.qa");
    expect(looksLikeEmail("ms.khan@school.qa")).toBe(true);
    expect(looksLikeEmail("ms khan@school")).toBe(false);
  });
});

describe("club description for parents", () => {
  const base = {
    clubName: "Comic Club",
    schoolName: "Hiboulala",
    track: "8-9" as const,
    termTitle: "Create Your Comic",
    termWeeks: 12,
    managerName: "Ms Khan",
    meetsDay: "Tuesday",
    meetsTime: "14:00",
    startsOn: "2027-01-11",
  };

  it("says who runs it, when, and the Comic Con date", () => {
    const text = parentClubDescription(base);
    expect(text).toContain("Comic Club: the AI Creators Club at Hiboulala (ages 8–9)");
    expect(text).toContain("12 weeks, Tuesdays at 14:00, led by Ms Khan");
    expect(text).toContain("First session: Tuesday 12 January 2027.");
    expect(text).toContain("Comic Con, where children present their comics to parents: Tuesday 30 March 2027.");
  });

  it("leaves out what isn't decided yet", () => {
    const text = parentClubDescription({ ...base, managerName: null, meetsDay: null, meetsTime: null, startsOn: null });
    expect(text).toContain("One hour a week for 12 weeks. Children work");
    expect(text).not.toContain("First session");
    expect(text).not.toContain("led by");
  });
});
