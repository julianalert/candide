import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { isMockAi } from "./env";
import { substitute, type Mission, type TeacherInputs } from "./missions";

// Every model call for kids goes through this file. The client never sees a key
// or a system prompt. Chat is Claude Sonnet as the spec asks; the classifier and
// the image prompt rewrite are Claude Haiku.

export const CHAT_MODEL = "claude-sonnet-5-5";
export const FAST_MODEL = "claude-haiku-5-5";
export const CHAT_MAX_TOKENS = 400;
export const HISTORY_LIMIT = 20;

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

const promptCache = new Map<string, string>();

/** Read one of the fixed prompt layers in /ai. Cached per process. */
export function readPromptFile(name: "safety.md" | "age-tier-8-11.md" | "moderation.md" | "image-rewrite.md"): string {
  const cached = promptCache.get(name);
  if (cached) return cached;
  const text = fs.readFileSync(path.join(process.cwd(), "ai", name), "utf8").trim();
  promptCache.set(name, text);
  return text;
}

/**
 * safety layer (+ mission blocked topics) → mission system prompt with teacher inputs and
 * kid rules substituted → age tier. The safety layer always comes first so nothing a
 * kid writes into {{kidRules}} can sit above it.
 */
export function assembleSystemPrompt(
  mission: Mission,
  teacherInputs: TeacherInputs = {},
  kidRules: string = "",
  layers: { safety?: string; ageTier?: string } = {},
): string {
  const safety = (layers.safety ?? readPromptFile("safety.md")).trim();
  const ageTier = (layers.ageTier ?? readPromptFile("age-tier-8-11.md")).trim();

  const blocked = mission.ai.blockedTopics.length
    ? `\n\nFor this mission, also never discuss, describe or depict: ${mission.ai.blockedTopics.join(", ")}.`
    : "";

  const vars: Record<string, string> = { ...teacherInputs };
  if (mission.ai.features.includes("rulesBox")) {
    vars.kidRules = kidRules.trim() || "(The child has not written any rules yet. Ask them to write some in the Rules box.)";
  }
  const missionPrompt = substitute(mission.ai.systemPrompt, vars).trim();

  return `${safety}${blocked}\n\n# This mission: ${mission.title}\n\n${missionPrompt}\n\n${ageTier}`;
}

export type HistoryMessage = {
  role: "user" | "assistant";
  kind: "text" | "image";
  content: string;
  blocked: boolean;
};

/** The last N transcript messages as API turns. Blocked kid messages never reach the model. */
export function buildHistory(messages: HistoryMessage[], limit: number = HISTORY_LIMIT): Anthropic.MessageParam[] {
  const usable = messages.filter((m) => !m.blocked && m.content.trim().length > 0);
  const recent = usable.slice(-limit);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent.map((m) => ({
    role: m.role,
    content: m.kind === "image" ? (m.role === "assistant" ? `(I made a picture of: ${m.content})` : `(Picture request: ${m.content})`) : m.content,
  }));
}

export type ChatResult = { text: string; refused: boolean; stopReason: string | null };

/** Stream one reply. `onDelta` receives text as it arrives; the resolved text is the whole reply. */
export async function streamChat(params: {
  system: string;
  history: Anthropic.MessageParam[];
  onDelta: (text: string) => void | Promise<void>;
}): Promise<ChatResult> {
  if (isMockAi()) return mockChat(params);

  const stream = anthropic().beta.messages.stream({
    model: CHAT_MODEL,
    max_tokens: CHAT_MAX_TOKENS,
    system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
    messages: params.history,
    // A 300-token kid reply does not need thinking; this is the documented way to turn it off on Sonnet 5.5.
    thinking: { type: "between_tools" },
    output_config: { effort: "low" },
    // If Sonnet declines for policy reasons, Anthropic retries on its default substitute server-side.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      await params.onDelta(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  const refused = final.stop_reason === "refusal";
  return { text, refused, stopReason: final.stop_reason ?? null };
}

async function mockChat(params: { system: string; history: Anthropic.MessageParam[]; onDelta: (t: string) => void | Promise<void> }): Promise<ChatResult> {
  const last = [...params.history].reverse().find((m) => m.role === "user");
  const said = typeof last?.content === "string" ? last.content : "";
  const reply = `That is a lovely idea. You said "${said.slice(0, 80)}". Tell me one more detail, like a colour or a sound, and I will help you shape it for the next step.`;
  for (const word of reply.split(/(?<= )/)) {
    await params.onDelta(word);
    await new Promise((r) => setTimeout(r, 12));
  }
  return { text: reply, refused: false, stopReason: "end_turn" };
}

// ---------- Image prompt rewrite ----------

export const IMAGE_STYLE_PRESET: Record<"illustrated" | "realistic", string> = {
  illustrated: "friendly digital illustration, bright colours, soft shapes, no text",
  realistic: "photograph, natural light, no people, no text",
};

const RewriteSchema = z.object({
  ok: z.boolean(),
  prompt: z.string(),
  reason: z.string(),
});

export type RewriteResult = z.infer<typeof RewriteSchema>;

/** Turn a kid's request into a safe image prompt with the mission's style preset. */
export async function rewriteImagePrompt(params: {
  text: string;
  mission: Mission;
  style: "illustrated" | "realistic";
}): Promise<RewriteResult> {
  const stylePreset = IMAGE_STYLE_PRESET[params.style];
  if (isMockAi()) {
    return { ok: true, prompt: `${params.text.trim()}. ${stylePreset}`, reason: "" };
  }

  const system = substitute(readPromptFile("image-rewrite.md"), {
    mission: `${params.mission.title} — ${params.mission.idea}`,
    blockedTopics: params.mission.ai.blockedTopics.join(", ") || "none",
    style: stylePreset,
  });

  const response = await anthropic().messages.parse({
    model: FAST_MODEL,
    max_tokens: 400,
    system,
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: zodOutputFormat(RewriteSchema) },
    messages: [{ role: "user", content: params.text }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return { ok: false, prompt: "", reason: "That picture is not one we can make here. Try describing something else." };
  }
  const parsed = response.parsed_output;
  if (parsed.ok && !/no text/i.test(parsed.prompt)) parsed.prompt = `${parsed.prompt.trim()} ${stylePreset}`;
  return parsed;
}
