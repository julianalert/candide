import { describe, expect, it } from "vitest";
import { imageEnabled, kidView, loadMissions, parseMission, placeholders, substitute } from "@/lib/missions";

describe("mission library", () => {
  const missions = loadMissions();

  it("loads ten valid missions numbered 1 to 10", () => {
    expect(missions).toHaveLength(10);
    expect(missions.map((m) => m.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(missions.map((m) => m.id)).size).toBe(10);
  });

  it("covers the three mission types", () => {
    const types = new Set(missions.map((m) => m.type));
    expect(types).toEqual(new Set(["creative", "literacy", "curriculum"]));
  });

  it("mission 4 is the only realistic-image mission", () => {
    const realistic = missions.filter((m) => m.ai.imageStyle === "realistic");
    expect(realistic.map((m) => m.number)).toEqual([4]);
  });

  it("mission 6 has the rules box and injects {{kidRules}}", () => {
    const six = missions.find((m) => m.number === 6)!;
    expect(six.ai.features).toContain("rulesBox");
    expect(placeholders(six.ai.systemPrompt)).toContain("kidRules");
  });

  it("mission 7 takes a teacher topic used in the prompt and the kid text", () => {
    const seven = missions.find((m) => m.number === 7)!;
    expect(seven.teacherInputs.map((i) => i.key)).toEqual(["topic"]);
    expect(placeholders(seven.ai.systemPrompt)).toContain("topic");
    const view = kidView(seven, { topic: "the water cycle" });
    expect(view.intro).toContain("the water cycle");
    expect(view.steps[0]).toContain("the water cycle");
    expect(view.starterPrompt).toContain("the water cycle");
  });

  it("image-off missions hide the picture toggle", () => {
    const five = missions.find((m) => m.number === 5)!;
    expect(imageEnabled(five)).toBe(false);
    expect(kidView(five).imageEnabled).toBe(false);
    const two = missions.find((m) => m.number === 2)!;
    expect(imageEnabled(two)).toBe(true);
  });

  it("the kid view never includes the system prompt", () => {
    const view = kidView(missions[0]) as Record<string, unknown>;
    expect(JSON.stringify(view)).not.toContain(missions[0].ai.systemPrompt.slice(0, 40));
    expect(view.ai).toBeUndefined();
  });
});

describe("mission schema", () => {
  const base = loadMissions()[1];

  it("rejects unknown placeholders in the system prompt", () => {
    const broken = { ...base, ai: { ...base.ai, systemPrompt: "Hello {{nobody}}" } };
    expect(() => parseMission(broken, "test")).toThrow(/unknown placeholder \{\{nobody\}\}/);
  });

  it("rejects image on with style none", () => {
    const broken = { ...base, ai: { ...base.ai, image: true, imageStyle: "none" } };
    expect(() => parseMission(broken, "test")).toThrow(/imageStyle/);
  });

  it("rejects unknown top-level fields", () => {
    expect(() => parseMission({ ...base, extra: 1 }, "test")).toThrow();
  });

  it("substitutes placeholders and blanks unknown ones", () => {
    expect(substitute("A {{ topic }} and {{other}}.", { topic: "frog" })).toBe("A frog and .");
  });
});
