import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPay(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function formatPayRange(min: number, max: number, type: string): string {
  const minStr = formatPay(min);
  const maxStr = formatPay(max);
  const suffix = type === "hourly" ? "/hr" : type === "salary" ? "/yr" : "";
  return `${minStr}–${maxStr}${suffix}`;
}
