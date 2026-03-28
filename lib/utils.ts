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
  const adjectives = [
    "Skilled", "Bright", "Swift", "Steady", "Sharp",
    "Ready", "Bold", "Quick", "Strong", "Smart",
  ];
  const nouns = [
    "Pro", "Star", "Ace", "Hero", "Champ",
    "Maven", "Scout", "Guide", "Lead", "Spark",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}${noun}_${num}`;
}
