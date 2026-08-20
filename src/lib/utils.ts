import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert a Date to a human-readable relative time string (e.g., "2h ago") */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Returns a UTC Date object representing Midnight in IST (Indian Standard Time)
 * for the given date. This ensures consistent "start of day" regardless of
 * where the server is hosted (Vercel UTC vs Localhost IST).
 */
export function getISTMidnight(date: Date = new Date()): Date {
  // IST is UTC + 5:30
  const tzOffsetMs = 5.5 * 60 * 60 * 1000;
  // Convert current time to IST
  const istTime = new Date(date.getTime() + tzOffsetMs);
  // Return UTC Midnight matching the IST year, month, date
  return new Date(Date.UTC(istTime.getUTCFullYear(), istTime.getUTCMonth(), istTime.getUTCDate()));
}

