// ─────────────────────────────────────────────────────────────
// Rate Limiter — In-Memory IP-Based Throttling
// ─────────────────────────────────────────────────────────────

import type { RateLimitEntry } from "@/types/dua";

const store = new Map<string, RateLimitEntry>();

const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "10", 10);
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);

/**
 * Checks whether an IP has exceeded the rate limit.
 * Returns true if the request should be blocked.
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  // First request or window expired
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  // Within window — increment
  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    return true;
  }

  return false;
}

/**
 * Periodic cleanup of expired entries to prevent memory leaks.
 * Runs every 5 minutes in long-lived server processes.
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
}
