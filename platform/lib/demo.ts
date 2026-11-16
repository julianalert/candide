import { z } from "zod";

// "Book a demo" on candideai.com. The form posts here; the route saves the request
// and emails the team (subject "DEMO ASKED FOR CANDIDE", set in Loops) and the person who asked.

const text = (max: number) => z.string().trim().max(max);

export const DemoRequestSchema = z.object({
  school: text(160).min(1, "School name is missing."),
  city_country: text(160).min(1, "City and country are missing."),
  contact_name: text(120).min(1, "Your name is missing."),
  role: text(120).min(1, "Your role is missing."),
  email: text(200).email("That email address doesn't look right."),
  phone: text(40).min(6, "Add a phone or WhatsApp number so we can reach you."),
  ages: z
    .union([z.array(text(40)), text(40)])
    .default([])
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean).slice(0, 5)),
  club_groups: text(60).default(""),
  devices: text(60).default(""),
  notes: text(2000).default(""),
});

export type DemoRequest = z.infer<typeof DemoRequestSchema>;

/** Origins allowed to post the form from a browser. */
export const DEMO_FORM_ORIGINS = ["https://candideai.com", "https://www.candideai.com"];

export function allowedOrigin(origin: string | null, production = process.env.NODE_ENV === "production"): string | null {
  if (!origin) return null;
  if (DEMO_FORM_ORIGINS.includes(origin)) return origin;
  if (!production && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin;
  return null;
}

/** Team inbox addresses, from DEMO_NOTIFY_EMAILS (comma-separated) so they stay out of the public repo. */
export function demoNotifyEmails(raw = process.env.DEMO_NOTIFY_EMAILS ?? ""): string[] {
  return [...new Set(raw.split(",").map((email) => email.trim().toLowerCase()).filter((email) => email.includes("@")))];
}

/** Loops transactional emails ("Demo · Team alert", "Demo · Confirmation"). Not secret; overridable. */
export function demoEmailIds() {
  return {
    teamAlert: process.env.LOOPS_DEMO_ALERT_ID || "cmwj7vllr0r7x0jz8xlec0jae",
    confirmation: process.env.LOOPS_DEMO_CONFIRM_ID || "cmwj80fx70rgo0j24wursr9wk",
  };
}

const blank = (value: string) => value.trim() || "—";

/** Data variables for the team alert. Loops refuses a send with an empty variable, hence the dashes. */
export function teamAlertVariables(request: DemoRequest): Record<string, string> {
  return {
    schoolName: blank(request.school),
    cityCountry: blank(request.city_country),
    contactName: blank(request.contact_name),
    role: blank(request.role),
    contactEmail: blank(request.email),
    phone: blank(request.phone),
    ages: blank(request.ages.join(", ")),
    clubGroups: blank(request.club_groups),
    devices: blank(request.devices),
    notes: blank(request.notes),
  };
}

export function confirmationVariables(request: DemoRequest): Record<string, string> {
  return { firstName: blank(request.contact_name.split(/\s+/)[0] ?? "") };
}
