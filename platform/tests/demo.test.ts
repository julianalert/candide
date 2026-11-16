import { describe, expect, it } from "vitest";
import { allowedOrigin, confirmationVariables, DemoRequestSchema, demoNotifyEmails, teamAlertVariables } from "@/lib/demo";
import { cleanRosterName, parseRosterNames } from "@/lib/format";

const valid = {
  school: "Hiboulala",
  city_country: "Paris, France",
  contact_name: "Julien Devoir",
  role: "Principal or Head of School",
  email: "head@school.example",
  phone: "+33 6 12 34 56 78",
  ages: ["8–9", "10–11"],
  club_groups: "2 or 3 groups",
  devices: "iPads",
  notes: "",
};

describe("demo request", () => {
  it("accepts the form as the site sends it", () => {
    const parsed = DemoRequestSchema.parse(valid);
    expect(parsed.ages).toEqual(["8–9", "10–11"]);
  });

  it("requires a phone number", () => {
    expect(DemoRequestSchema.safeParse({ ...valid, phone: "" }).success).toBe(false);
    expect(DemoRequestSchema.safeParse({ ...valid, phone: undefined }).success).toBe(false);
  });

  it("rejects a bad email", () => {
    expect(DemoRequestSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("takes a single age as a string", () => {
    expect(DemoRequestSchema.parse({ ...valid, ages: "8–9" }).ages).toEqual(["8–9"]);
  });

  it("fills every Loops variable, with a dash for blanks", () => {
    const alert = teamAlertVariables(DemoRequestSchema.parse(valid));
    expect(alert.notes).toBe("—");
    expect(alert.ages).toBe("8–9, 10–11");
    expect(Object.values(alert).every((value) => value.length > 0)).toBe(true);
    expect(confirmationVariables(DemoRequestSchema.parse(valid))).toEqual({ firstName: "Julien" });
  });

  it("reads the team addresses from the environment, without repeats", () => {
    expect(demoNotifyEmails(" a@x.com, B@x.com ,a@x.com,nope")).toEqual(["a@x.com", "b@x.com"]);
    expect(demoNotifyEmails("")).toEqual([]);
  });

  it("only lets the marketing site post in production", () => {
    expect(allowedOrigin("https://candideai.com", true)).toBe("https://candideai.com");
    expect(allowedOrigin("https://www.candideai.com", true)).toBe("https://www.candideai.com");
    expect(allowedOrigin("http://localhost:4173", true)).toBeNull();
    expect(allowedOrigin("http://localhost:4173", false)).toBe("http://localhost:4173");
    expect(allowedOrigin("https://evil.example", false)).toBeNull();
  });
});

describe("club list names", () => {
  it("keeps first names and initials", () => {
    expect(cleanRosterName("  sam k. ")).toBe("Sam k.");
    expect(cleanRosterName("Zoë")).toBe("Zoë");
    expect(cleanRosterName("<script>")).toBe("Script");
    expect(cleanRosterName("123")).toBe("");
  });

  it("splits a pasted list and drops repeats", () => {
    expect(parseRosterNames("Sam\nLina, Omar K.\n\nsam;Yusuf")).toEqual(["Sam", "Lina", "Omar K.", "Yusuf"]);
  });
});
