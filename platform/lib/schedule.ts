// When a club meets, and which date each week of the term falls on.
// Dates are plain calendar days ("YYYY-MM-DD") handled in UTC so no timezone
// can move them by a day.

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Day = (typeof DAYS)[number];

export function isDay(value: unknown): value is Day {
  return typeof value === "string" && (DAYS as readonly string[]).includes(value);
}

export function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseIsoDate(value);
  return date !== null && date.toISOString().slice(0, 10) === value;
}

export function parseIsoDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Tuesdays · 14:00", "Tuesdays", or "" when nothing is set. */
export function meetsLabel(day: string | null | undefined, time: string | null | undefined): string {
  const parts = [isDay(day) ? `${day}s` : "", isTime(time) ? time : ""].filter(Boolean);
  return parts.join(" · ");
}

/**
 * The date of a week of the term: the club's first meeting day on or after the term
 * start, then a week later each week. Without a meeting day, week 1 is the term start.
 */
export function weekDate(termStart: string | null | undefined, day: string | null | undefined, week: number): Date | null {
  if (!termStart || !isIsoDate(termStart) || week < 1) return null;
  const start = parseIsoDate(termStart)!;
  let offset = 0;
  if (isDay(day)) {
    const target = (DAYS.indexOf(day) + 1) % 7; // JS: Sunday = 0
    offset = (target - start.getUTCDay() + 7) % 7;
  }
  return new Date(start.getTime() + (offset + 7 * (week - 1)) * 24 * 60 * 60 * 1000);
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const longFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// ICU versions disagree on a comma after the weekday ("Tuesday, 13 January"); drop it everywhere.

/** "Tue 13 Jan" */
export function shortDay(date: Date | null): string {
  return date ? dayFormat.format(date).replace(/,/g, "") : "";
}

/** "Tuesday 13 January 2027" */
export function longDay(date: Date | null): string {
  return date ? longFormat.format(date).replace(/,/g, "") : "";
}
