// Transactional email through Loops (https://loops.so). Auth emails go through
// Loops SMTP from Supabase; everything the app sends itself goes through here.

const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";

export class LoopsNotConfigured extends Error {}

export function loopsConfigured(): boolean {
  return Boolean(process.env.LOOPS_API_KEY);
}

/**
 * Send one published Loops transactional email. Every data variable on the template
 * must be present and non-empty, or Loops refuses the send, so callers pass "—" for blanks.
 */
export async function sendTransactionalEmail(params: {
  transactionalId: string;
  email: string;
  dataVariables: Record<string, string>;
}): Promise<void> {
  const key = process.env.LOOPS_API_KEY;
  if (!key) throw new LoopsNotConfigured("LOOPS_API_KEY is not set");
  const response = await fetch(LOOPS_TRANSACTIONAL_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Loops responded ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
}
