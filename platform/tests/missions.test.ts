import { describe, expect, it } from "vitest";
import { chatEnabled, imageEnabled, kidView, loadTerms, parseMission, placeholders, snapshotInfo, substitute } from "@/lib/missions";

describe("Term 1: Create Your Comic", () => {
  const [bundle, ...others] = loadTerms();
  const { term, missions } = bundle;

  it("is the only term, with twelve weekly missions in order", () => {
    expect(others).toHaveLength(0);
    expect(term.id).toBe("create-your-comic");
    expect(term.weeks).toBe(12);
    expect(missions.map((m) => m.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(missions.map((m) => m.id)).size).toBe(12);
  });

  it("covers every week with exactly one phase", () => {
    const weeks = term.phases.flatMap((p) => p.weeks).sort((a, b) => a - b);
    expect(weeks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const mission of missions) {
      const phase = term.phases.find((p) => p.weeks.includes(mission.week))!;
      expect(mission.phase).toBe(phase.title);
    }
  });

  it("week 7 is on paper: no chat, no pictures", () => {
    const seven = missions.find((m) => m.week === 7)!;
    expect(seven.paperOnly).toBe(true);
    expect(chatEnabled(seven)).toBe(false);
    expect(imageEnabled(seven)).toBe(false);
    expect(kidView(seven).chatEnabled).toBe(false);
  });

  it("week 6 is the editor week: chat only, never rewrites", () => {
    const six = missions.find((m) => m.week === 6)!;
    expect(imageEnabled(six)).toBe(false);
    expect(six.ai.systemPrompt).toMatch(/Never rewrite/);
  });

  it("the older track gets a villain in week 4 and different steps", () => {
    const four = missions.find((m) => m.week === 4)!;
    expect(kidView(four, "8-9").steps.join(" ")).not.toMatch(/villain/i);
    expect(kidView(four, "10-11").steps.join(" ")).toMatch(/villain/i);
  });

  it("pictures follow the three-tries rule", () => {
    for (const mission of missions.filter(imageEnabled)) {
      expect(mission.ai.caps.imageRetriesPerPrompt + 1).toBe(3);
    }
  });

  it("the kid view never includes the system prompt or the AI's track notes", () => {
    for (const mission of missions) {
      const view = JSON.stringify(kidView(mission, "10-11"));
      if (mission.ai.chat) expect(view).not.toContain(mission.ai.systemPrompt.slice(0, 40));
      expect(view).not.toContain(mission.tracks["10-11"].aiNotes);
    }
  });
});

describe("mission schema", () => {
  const base = loadTerms()[0].missions[1];

  it("rejects unknown placeholders in the system prompt", () => {
    const broken = { ...base, ai: { ...base.ai, systemPrompt: "Hello {{nobody}}" } };
    expect(() => parseMission(broken, "test")).toThrow(/unknown placeholder \{\{nobody\}\}/);
  });

  it("rejects image on with style none", () => {
    const broken = { ...base, ai: { ...base.ai, image: true, imageStyle: "none" } };
    expect(() => parseMission(broken, "test")).toThrow(/imageStyle/);
  });

  it("rejects a paper week that keeps the AI on", () => {
    expect(() => parseMission({ ...base, paperOnly: true }, "test")).toThrow(/paper-only/);
  });

  it("rejects unknown top-level fields and a missing track", () => {
    expect(() => parseMission({ ...base, extra: 1 }, "test")).toThrow();
    expect(() => parseMission({ ...base, tracks: { "8-9": base.tracks["8-9"] } }, "test")).toThrow();
  });

  it("substitutes placeholders and blanks unknown ones", () => {
    expect(substitute("A {{ topic }} and {{other}}.", { topic: "frog" })).toBe("A frog and .");
    expect(placeholders("{{a}} {{ b }}")).toEqual(["a", "b"]);
  });
});

describe("snapshots", () => {
  it("reads weeks from new snapshots and numbers from old ones", () => {
    expect(snapshotInfo({ week: 3, title: "Lock your hero", skill: "Consistency" })).toEqual({ week: 3, title: "Lock your hero", skill: "Consistency" });
    expect(snapshotInfo({ number: 2, title: "Invent a Creature", idea: "Precise prompts" })).toEqual({ week: 2, title: "Invent a Creature", skill: "Precise prompts" });
    expect(snapshotInfo(null)).toEqual({ week: null, title: "Mission", skill: "" });
  });
});
