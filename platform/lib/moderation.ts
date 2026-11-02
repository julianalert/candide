import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropic, FAST_MODEL, readPromptFile } from "./ai";
import { isMockAi } from "./env";
import { substitute, type Mission } from "./missions";
import type { Moderation } from "./types";

// Fixed classifier run on every kid message before the model and on every reply
// after it. Blocked content is stored with its reason for the safety review.

export const SOFT_BLOCK_MESSAGE = "Let's keep it about the mission. Try another way?";
export const NEUTRAL_REPLACEMENT = "Let's try that a different way. What would you like to do for this step?";

export const MODERATION_REASONS = [
  "self_harm",
  "sexual",
  "violence",
  "hate",
  "drugs",
  "real_person",
  "pii",
  "jailbreak",
  "off_mission",
  "unsafe_for_kids",
  "none",
] as const;

const VerdictSchema = z.object({
  ok: z.boolean(),
  reason: z.enum(MODERATION_REASONS),
});

export type ModerationStage = "input" | "output";

export async function moderate(text: string, ctx: { mission: Mission; stage: ModerationStage }): Promise<Moderation> {
  if (isMockAi()) return mockModerate(text, ctx.stage);

  const system = substitute(readPromptFile("moderation.md"), {
    mission: `${ctx.mission.title} — ${ctx.mission.idea}. ${ctx.mission.kid.intro}`,
    stage: ctx.stage,
    blockedTopics: ctx.mission.ai.blockedTopics.join(", ") || "none",
  });

  try {
    const response = await anthropic().messages.parse({
      model: FAST_MODEL,
      max_tokens: 200,
      system,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: zodOutputFormat(VerdictSchema) },
      messages: [{ role: "user", content: `<message>\n${text}\n</message>` }],
    });

    // The classifier itself refusing means the message was bad enough to trip the model's own safeguards.
    if (response.stop_reason === "refusal") return { ok: false, reason: "unsafe_for_kids", stage: ctx.stage };
    const verdict = response.parsed_output;
    if (!verdict) return { ok: false, reason: "classifier_error", stage: ctx.stage };
    return verdict.ok ? { ok: true, stage: ctx.stage } : { ok: false, reason: verdict.reason === "none" ? "unsafe_for_kids" : verdict.reason, stage: ctx.stage };
  } catch (error) {
    // Fail closed: a child never sees unmoderated text because the classifier was down.
    console.error("moderation failed", error);
    return { ok: false, reason: "classifier_error", stage: ctx.stage };
  }
}

/** Keyword stand-in used with AI_MOCK=1 so the soft-block path can be exercised offline. */
function mockModerate(text: string, stage: ModerationStage): Moderation {
  const lower = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(kill|murder|gun|blood|stab)\b/, "violence"],
    [/\b(address|phone number|surname|password)\b/, "pii"],
    [/\b(ignore your rules|ignore all|system prompt|jailbreak)\b/, "jailbreak"],
    [/\b(sex|naked|nude)\b/, "sexual"],
  ];
  for (const [pattern, reason] of rules) {
    if (pattern.test(lower)) return { ok: false, reason, stage };
  }
  return { ok: true, stage };
}
