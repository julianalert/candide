import { randomBytes } from "node:crypto";

// Uppercase letters and digits without the look-alikes 0/O and 1/I. 32 symbols,
// so a byte masked to 5 bits picks one without bias.
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CLASS_CODE_LENGTH = 6;
export const PUBLIC_ID_LENGTH = 12;

export function randomCode(length: number, alphabet: string = CODE_ALPHABET): string {
  if (alphabet.length !== 32) throw new Error("randomCode expects a 32-symbol alphabet");
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] & 31];
  return out;
}

export function newClassCode(): string {
  return randomCode(CLASS_CODE_LENGTH);
}

export function newPublicId(): string {
  return randomCode(PUBLIC_ID_LENGTH);
}

/** What a kid typed → the canonical code: uppercase, no spaces or dashes. */
export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidClassCode(code: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CLASS_CODE_LENGTH}}$`).test(code);
}
