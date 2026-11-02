import type { PlayMessage, PlayState } from "@/lib/types";

export type ChatEvent =
  | { type: "start"; userMessage: PlayMessage }
  | { type: "blocked"; message: string }
  | { type: "delta"; text: string }
  | { type: "done"; message: PlayMessage; replaced: boolean }
  | { type: "error"; message: string };

export class ApiError extends Error {
  constructor(message: string, readonly code: string | undefined, readonly status: number) {
    super(message);
  }
}

async function readError(res: Response): Promise<ApiError> {
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return new ApiError(json.error ?? "Something went wrong.", json.code, res.status);
}

export async function postJson<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as T;
}

export async function fetchState(): Promise<PlayState> {
  const res = await fetch("/api/play/state", { cache: "no-store" });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as PlayState;
}

/** POST a chat message and yield the newline-delimited JSON events as they stream in. */
export async function* streamMessage(text: string): AsyncGenerator<ChatEvent> {
  const res = await fetch("/api/play/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) throw await readError(res);
  if (!res.body) throw new ApiError("No response.", undefined, 500);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as ChatEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as ChatEvent;
}
