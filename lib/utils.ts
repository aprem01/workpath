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
  // Abstract, friendly handles like social media usernames
  // No real words to avoid unintended meaning (Caroline's feedback)
  const syllables = [
    "kee", "joo", "mee", "too", "noo", "bee", "zee", "loo",
    "poo", "roo", "woo", "doo", "foo", "hoo", "koo", "yoo",
    "ka", "to", "bu", "mi", "ze", "ri", "lu", "na", "fi", "da",
  ];
  const s1 = syllables[Math.floor(Math.random() * syllables.length)];
  const s2 = syllables[Math.floor(Math.random() * syllables.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${s1}${s2}${num}`;
}
