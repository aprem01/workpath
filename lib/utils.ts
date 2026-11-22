import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPay(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function formatPayRange(min: number, max: number, type?: string): string {
  const minStr = formatPay(min);
  const maxStr = formatPay(max);
  const suffix = type === "salary" ? "/yr" : "/hr";
  return `${minStr}–${maxStr}${suffix}`;
}

export function generateAnonymousHandle(): string {
  // Caroline's exact format:
  // Cap Consonant + 2 lowercase vowels + Cap Consonant + 1-2 lowercase vowels + 3 numbers
  // Examples: KeeTo325, BoaMi905, MooGy123, XioDu367
  const vowels = ["a", "e", "i", "o", "u", "y"];
  const consonants = [
    "b", "c", "d", "f", "g", "h", "j", "k", "l", "m",
    "n", "p", "q", "r", "s", "t", "v", "w", "x", "z",
  ];
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  const c1 = pick(consonants).toUpperCase();
  const v1a = pick(vowels);
  const v1b = pick(vowels);
  const c2 = pick(consonants).toUpperCase();
  const v2a = pick(vowels);
  // Sometimes 2 vowels at the end, sometimes 1
  const v2b = Math.random() > 0.4 ? pick(vowels) : "";
  const num = Math.floor(100 + Math.random() * 900);

  return `${c1}${v1a}${v1b}${c2}${v2a}${v2b}${num}`;
}

/**
 * Only ever hand the browser an http(s) link.
 *
 * Apply URLs come from third-party job feeds (Adzuna today, Greenhouse /
 * Lever later), so they are untrusted input that we put straight into an
 * `href` and a `window.open`. A `javascript:` or `data:` URL there would
 * run in the worker's session. Anything that is not plain http(s) is
 * dropped rather than rendered.
 */
export function safeExternalUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/**
 * Escape text for interpolation into an HTML body.
 *
 * Needed because the contact routes send an HTML notification email that
 * embeds the sender's name, message and campaign. Those all originate
 * outside our control — the message from a form field, the campaign from
 * the landing URL's query string by way of a cookie — so each one is an
 * injection vector into the mail we read.
 */
export function escapeHtml(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip CR/LF so a value cannot break out of an email subject line. */
export function singleLine(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/[\r\n]+/g, " ").trim();
}
