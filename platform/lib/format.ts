const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  return dateFormat.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return `${dateFormat.format(date)} · ${timeFormat.format(date)}`;
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  return timeFormat.format(typeof value === "string" ? new Date(value) : value);
}

/** "Sam", "Sam 2", "Sam 3": the badge name when a first name is already taken. */
export function dedupeName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  for (let n = 2; n < 100; n++) {
    const candidate = `${name} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${name} ${Date.now() % 1000}`;
}

/** Keep a first name a first name: letters, spaces, hyphens, apostrophes; title-cased; max 20 chars. */
export function cleanFirstName(raw: string): string {
  const trimmed = raw.replace(/[^\p{L}\p{M}' -]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!trimmed) return "";
  const first = trimmed.split(" ")[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}
