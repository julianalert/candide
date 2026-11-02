import { placeholderImage } from "./png";

// One interface, three providers. Which one runs is an environment choice so the
// image provider (an open decision in the spec) can be swapped without a code change.

export type ImageStyle = "illustrated" | "realistic";
export type ImageProviderName = "openai" | "google" | "mock";

export interface ImageProvider {
  readonly name: ImageProviderName;
  /** Returns PNG bytes for a 1:1 image. */
  generate(prompt: string, style: ImageStyle): Promise<Buffer>;
}

export class ImageProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function imageProviderName(): ImageProviderName {
  const value = (process.env.IMAGE_PROVIDER ?? "").toLowerCase();
  if (value === "openai" || value === "google" || value === "mock") return value;
  if (!warned) {
    console.warn("IMAGE_PROVIDER is not set; using the mock image provider.");
    warned = true;
  }
  return "mock";
}
let warned = false;

export function getImageProvider(name: ImageProviderName = imageProviderName()): ImageProvider {
  switch (name) {
    case "openai":
      return openAiProvider();
    case "google":
      return googleProvider();
    default:
      return mockProvider();
  }
}

function apiKey(): string {
  const key = process.env.IMAGE_API_KEY;
  if (!key) throw new ImageProviderError("IMAGE_API_KEY is not set");
  return key;
}

/** OpenAI gpt-image-1. `moderation: "auto"` is the stricter tier; EU residency via IMAGE_API_BASE_URL. */
function openAiProvider(): ImageProvider {
  return {
    name: "openai",
    async generate(prompt, style) {
      const base = (process.env.IMAGE_API_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
      const response = await fetch(`${base}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey()}` },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          n: 1,
          size: "1024x1024",
          quality: style === "realistic" ? "medium" : "low",
          moderation: "auto",
          output_format: "png",
        }),
      });
      if (!response.ok) throw new ImageProviderError(`OpenAI images failed: ${response.status} ${await safeText(response)}`, response.status);
      const json = (await response.json()) as { data?: { b64_json?: string }[] };
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) throw new ImageProviderError("OpenAI images returned no image");
      return Buffer.from(b64, "base64");
    },
  };
}

/** Google Imagen through the Gemini API. `personGeneration: dont_allow` blocks people outright. */
function googleProvider(): ImageProvider {
  return {
    name: "google",
    async generate(prompt) {
      const model = process.env.IMAGE_MODEL ?? "imagen-4.0-generate-001";
      const base = (process.env.IMAGE_API_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
      const response = await fetch(`${base}/models/${model}:predict`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey() },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: "1:1", personGeneration: "dont_allow" },
        }),
      });
      if (!response.ok) throw new ImageProviderError(`Imagen failed: ${response.status} ${await safeText(response)}`, response.status);
      const json = (await response.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
      const b64 = json.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) throw new ImageProviderError("Imagen returned no image (possibly filtered)");
      return Buffer.from(b64, "base64");
    },
  };
}

function mockProvider(): ImageProvider {
  return {
    name: "mock",
    async generate(prompt) {
      return placeholderImage(prompt);
    },
  };
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return "";
  }
}
