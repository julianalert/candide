import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

// A mission is one JSON file in /missions. This schema is the contract: the seed
// script validates every file before it reaches the database, and the play routes
// trust the snapshot stored on the session.

export const MISSION_TYPES = ["creative", "literacy", "curriculum"] as const;
export const IMAGE_STYLES = ["illustrated", "realistic", "none"] as const;
export const FEATURES = ["rulesBox", "imageOff"] as const;

export const TeacherInputSchema = z.strictObject({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "key must be an identifier"),
  label: z.string().min(1),
  placeholder: z.string().default(""),
});

export const MissionSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be a kebab-case slug"),
    number: z.number().int().min(1),
    title: z.string().min(1),
    type: z.enum(MISSION_TYPES),
    idea: z.string().min(1),
    durationMin: z.number().int().positive().default(45),
    ageMin: z.number().int().default(8),
    ageMax: z.number().int().default(11),
    teacher: z.strictObject({
      hook: z.string().min(1),
      share: z.string().min(1),
      debrief: z.string().min(1),
      stretch: z.string().min(1),
      simplify: z.string().min(1),
    }),
    teacherInputs: z.array(TeacherInputSchema).default([]),
    kid: z.strictObject({
      intro: z.string().min(1),
      steps: z.array(z.string().min(1)).min(1),
      starterPrompt: z.string().min(1),
    }),
    ai: z.strictObject({
      systemPrompt: z.string().min(1),
      chat: z.boolean().default(true),
      image: z.boolean(),
      imageStyle: z.enum(IMAGE_STYLES).default("illustrated"),
      caps: z.strictObject({
        messages: z.number().int().positive(),
        images: z.number().int().min(0),
        imageRetriesPerPrompt: z.number().int().min(0),
      }),
      features: z.array(z.enum(FEATURES)).default([]),
      blockedTopics: z.array(z.string().min(1)).default([]),
    }),
  })
  .superRefine((mission, ctx) => {
    if (mission.ai.image && mission.ai.imageStyle === "none") {
      ctx.addIssue({ code: "custom", path: ["ai", "imageStyle"], message: "image is on but imageStyle is none" });
    }
    const allowed = new Set(mission.teacherInputs.map((input) => input.key));
    if (mission.ai.features.includes("rulesBox")) allowed.add("kidRules");
    for (const key of placeholders(mission.ai.systemPrompt)) {
      if (!allowed.has(key)) {
        ctx.addIssue({ code: "custom", path: ["ai", "systemPrompt"], message: `unknown placeholder {{${key}}}` });
      }
    }
    for (const key of placeholders([mission.kid.intro, ...mission.kid.steps].join("\n"))) {
      if (!mission.teacherInputs.some((input) => input.key === key)) {
        ctx.addIssue({ code: "custom", path: ["kid"], message: `unknown placeholder {{${key}}} in kid text` });
      }
    }
  });

export type Mission = z.infer<typeof MissionSchema>;
export type MissionType = Mission["type"];
export type TeacherInput = z.infer<typeof TeacherInputSchema>;
export type TeacherInputs = Record<string, string>;

export function placeholders(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)) found.add(match[1]);
  return [...found];
}

/** Replace {{key}} placeholders; unknown keys become an empty string. */
export function substitute(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, key: string) => (vars[key] ?? "").trim());
}

export function imageEnabled(mission: Mission): boolean {
  return mission.ai.image && mission.ai.imageStyle !== "none" && !mission.ai.features.includes("imageOff");
}

export function parseMission(input: unknown, source = "mission"): Mission {
  const result = MissionSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n");
    throw new Error(`Invalid mission in ${source}:\n${details}`);
  }
  return result.data;
}

export function missionsDir(): string {
  return path.join(process.cwd(), "missions");
}

/** Load and validate every mission file. Throws on the first invalid file, duplicate id or number. */
export function loadMissions(dir: string = missionsDir()): Mission[] {
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  const missions = files.map((file) => parseMission(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")), file));

  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const mission of missions) {
    if (ids.has(mission.id)) throw new Error(`Duplicate mission id ${mission.id}`);
    if (numbers.has(mission.number)) throw new Error(`Duplicate mission number ${mission.number}`);
    ids.add(mission.id);
    numbers.add(mission.number);
  }
  return missions.sort((a, b) => a.number - b.number);
}

/** What the kid's browser is allowed to see. Never the system prompt. */
export function kidView(mission: Mission, teacherInputs: TeacherInputs = {}) {
  return {
    id: mission.id,
    number: mission.number,
    title: mission.title,
    type: mission.type,
    idea: mission.idea,
    intro: substitute(mission.kid.intro, teacherInputs),
    steps: mission.kid.steps.map((step) => substitute(step, teacherInputs)),
    starterPrompt: substitute(mission.kid.starterPrompt, teacherInputs),
    imageEnabled: imageEnabled(mission),
    rulesBox: mission.ai.features.includes("rulesBox"),
    caps: mission.ai.caps,
  };
}

export type KidMission = ReturnType<typeof kidView>;

export const MISSION_TYPE_LABEL: Record<MissionType, string> = {
  creative: "Creative",
  literacy: "Literacy",
  curriculum: "Curriculum",
};
