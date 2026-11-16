import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

// The AI Creators Club is built on terms. A term has a topic and a goal and one
// mission per week. Each term is a folder in /terms: term.json plus one file per
// week. These schemas are the contract: the seed script validates every file before
// it reaches the database, and the play routes trust the snapshot stored on the session.

export const TRACKS = ["8-9", "10-11"] as const;
export type Track = (typeof TRACKS)[number];
export const TRACK_LABEL: Record<Track, string> = { "8-9": "Ages 8–9", "10-11": "Ages 10–11" };

export function isTrack(value: unknown): value is Track {
  return typeof value === "string" && (TRACKS as readonly string[]).includes(value);
}

export const IMAGE_STYLES = ["illustrated", "realistic", "none"] as const;
export const FEATURES = ["rulesBox", "imageOff"] as const;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be a kebab-case slug");

export const TermSchema = z.strictObject({
  id: slug,
  number: z.number().int().min(1),
  title: z.string().min(1),
  topic: z.string().min(1),
  goal: z.string().min(1),
  weeks: z.number().int().min(1).max(20),
  sessionMin: z.number().int().positive().default(60),
  showcase: z.string().min(1),
  phases: z.array(z.strictObject({ title: z.string().min(1), weeks: z.array(z.number().int().min(1)).min(1) })).min(1),
  /** Club rules the teacher repeats every week. */
  rules: z.array(z.string().min(1)).default([]),
});

export type Term = z.infer<typeof TermSchema>;

export const TeacherInputSchema = z.strictObject({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "key must be an identifier"),
  label: z.string().min(1),
  placeholder: z.string().default(""),
});

const TrackSchema = z.strictObject({
  /** Replaces the default kid steps for this track. */
  steps: z.array(z.string().min(1)).min(1).optional(),
  /** Added to the AI's instructions for this track. */
  aiNotes: z.string().min(1),
});

export const MissionSchema = z
  .strictObject({
    id: slug,
    term: slug,
    week: z.number().int().min(1),
    title: z.string().min(1),
    phase: z.string().min(1),
    /** The AI skill the week teaches, in a sentence a child could say. */
    skill: z.string().min(1),
    /** What every child has saved at the end of the session. */
    output: z.string().min(1),
    durationMin: z.number().int().positive().default(60),
    /** A week done on paper: the platform shows the mission and the board, no AI. */
    paperOnly: z.boolean().default(false),
    teacher: z.strictObject({
      warmUp: z.string().min(1),
      miniLesson: z.string().min(1),
      studio: z.string().min(1),
      shareSave: z.string().min(1),
      printables: z.array(z.string().min(1)).default([]),
    }),
    teacherInputs: z.array(TeacherInputSchema).default([]),
    kid: z.strictObject({
      intro: z.string().min(1),
      steps: z.array(z.string().min(1)).min(1),
      starterPrompt: z.string().min(1),
    }),
    tracks: z.strictObject({ "8-9": TrackSchema, "10-11": TrackSchema }),
    ai: z.strictObject({
      systemPrompt: z.string().min(1),
      chat: z.boolean().default(true),
      image: z.boolean(),
      imageStyle: z.enum(IMAGE_STYLES).default("illustrated"),
      caps: z.strictObject({
        messages: z.number().int().min(0),
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
    if (mission.paperOnly && (mission.ai.chat || mission.ai.image)) {
      ctx.addIssue({ code: "custom", path: ["paperOnly"], message: "a paper-only week has chat and image off" });
    }
    if (mission.ai.chat && mission.ai.caps.messages < 1) {
      ctx.addIssue({ code: "custom", path: ["ai", "caps", "messages"], message: "chat is on but the message cap is 0" });
    }
    const allowed = new Set(mission.teacherInputs.map((input) => input.key));
    if (mission.ai.features.includes("rulesBox")) allowed.add("kidRules");
    for (const key of placeholders(mission.ai.systemPrompt)) {
      if (!allowed.has(key)) {
        ctx.addIssue({ code: "custom", path: ["ai", "systemPrompt"], message: `unknown placeholder {{${key}}}` });
      }
    }
    const kidText = [mission.kid.intro, mission.kid.starterPrompt, ...mission.kid.steps, ...TRACKS.flatMap((t) => mission.tracks[t].steps ?? [])];
    for (const key of placeholders(kidText.join("\n"))) {
      if (!mission.teacherInputs.some((input) => input.key === key)) {
        ctx.addIssue({ code: "custom", path: ["kid"], message: `unknown placeholder {{${key}}} in kid text` });
      }
    }
  });

export type Mission = z.infer<typeof MissionSchema>;
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

export function chatEnabled(mission: Mission): boolean {
  return mission.ai.chat && !mission.paperOnly;
}

export function imageEnabled(mission: Mission): boolean {
  return mission.ai.image && mission.ai.imageStyle !== "none" && !mission.ai.features.includes("imageOff") && !mission.paperOnly;
}

export function parseMission(input: unknown, source = "mission"): Mission {
  const result = MissionSchema.safeParse(input);
  if (!result.success) throw new Error(`Invalid mission in ${source}:\n${formatIssues(result.error)}`);
  return result.data;
}

export function parseTerm(input: unknown, source = "term"): Term {
  const result = TermSchema.safeParse(input);
  if (!result.success) throw new Error(`Invalid term in ${source}:\n${formatIssues(result.error)}`);
  return result.data;
}

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n");
}

/** "Week 3 · Lock your hero" for any stored snapshot, including the old standalone missions. */
export function snapshotInfo(snapshot: unknown): { week: number | null; title: string; skill: string } {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  const week = typeof s.week === "number" ? s.week : typeof s.number === "number" ? s.number : null;
  const title = typeof s.title === "string" ? s.title : "Mission";
  const skill = typeof s.skill === "string" ? s.skill : typeof s.idea === "string" ? s.idea : "";
  return { week, title, skill };
}

// ---------- Loading the curriculum from disk ----------

export type TermBundle = { term: Term; missions: Mission[] };

export function termsDir(): string {
  return path.join(process.cwd(), "terms");
}

/** Load and validate every term folder. Throws on an invalid file, a missing week or a duplicate. */
export function loadTerms(dir: string = termsDir()): TermBundle[] {
  const folders = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const bundles = folders.map((folder) => {
    const base = path.join(dir, folder);
    const term = parseTerm(readJson(path.join(base, "term.json")), `${folder}/term.json`);
    if (term.id !== folder) throw new Error(`Term folder ${folder} holds term ${term.id}; rename one of them`);

    const missions = fs
      .readdirSync(base)
      .filter((file) => file.endsWith(".json") && file !== "term.json")
      .sort()
      .map((file) => parseMission(readJson(path.join(base, file)), `${folder}/${file}`));

    const weeks = new Set<number>();
    const ids = new Set<string>();
    for (const mission of missions) {
      if (mission.term !== term.id) throw new Error(`${mission.id} says term ${mission.term} but sits in ${term.id}`);
      if (weeks.has(mission.week)) throw new Error(`Two missions for week ${mission.week} in ${term.id}`);
      if (ids.has(mission.id)) throw new Error(`Duplicate mission id ${mission.id}`);
      weeks.add(mission.week);
      ids.add(mission.id);
    }
    for (let week = 1; week <= term.weeks; week++) {
      if (!weeks.has(week)) throw new Error(`${term.id} has no mission for week ${week}`);
    }
    if (weeks.size !== term.weeks) throw new Error(`${term.id} has ${weeks.size} missions for ${term.weeks} weeks`);
    return { term, missions: missions.sort((a, b) => a.week - b.week) };
  });

  const numbers = new Set<number>();
  const missionIds = new Set<string>();
  for (const { term, missions } of bundles) {
    if (numbers.has(term.number)) throw new Error(`Duplicate term number ${term.number}`);
    numbers.add(term.number);
    for (const mission of missions) {
      if (missionIds.has(mission.id)) throw new Error(`Mission id ${mission.id} is used in two terms`);
      missionIds.add(mission.id);
    }
  }
  return bundles.sort((a, b) => a.term.number - b.term.number);
}

/** Every mission of every term, in term then week order. */
export function loadMissions(dir: string = termsDir()): Mission[] {
  return loadTerms(dir).flatMap((bundle) => bundle.missions);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// ---------- What the kid's browser may see ----------

export function kidSteps(mission: Mission, track: Track, teacherInputs: TeacherInputs = {}): string[] {
  return (mission.tracks[track].steps ?? mission.kid.steps).map((step) => substitute(step, teacherInputs));
}

/** Never includes the system prompt or the track notes for the AI. */
export function kidView(mission: Mission, track: Track = "8-9", teacherInputs: TeacherInputs = {}) {
  return {
    id: mission.id,
    term: mission.term,
    week: mission.week,
    title: mission.title,
    phase: mission.phase,
    skill: mission.skill,
    output: mission.output,
    intro: substitute(mission.kid.intro, teacherInputs),
    steps: kidSteps(mission, track, teacherInputs),
    starterPrompt: substitute(mission.kid.starterPrompt, teacherInputs),
    chatEnabled: chatEnabled(mission),
    imageEnabled: imageEnabled(mission),
    paperOnly: mission.paperOnly,
    rulesBox: mission.ai.features.includes("rulesBox"),
    caps: mission.ai.caps,
  };
}

export type KidMission = ReturnType<typeof kidView>;
