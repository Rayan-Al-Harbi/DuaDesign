// ─────────────────────────────────────────────────────────────
// Stage 1 — Input Processing & Safety
// ─────────────────────────────────────────────────────────────

import type { PreprocessingResult, ValidatedInput } from "@/types/dua";

const MAX_WISHES = 5;
const MAX_WISH_LENGTH = 100;

/**
 * Blocked patterns for content moderation.
 * Covers harmful, violent, hateful, or manipulative intent
 * in both English and Arabic.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  // English harmful patterns
  /\b(kill|murder|destroy|harm|hurt|attack|bomb|weapon|die|death|suicide|revenge|curse|damn)\b/i,
  /\b(hate|hatred)\b/i,
  // Arabic harmful patterns
  /دمار|قتل|انتقام|لعن|سلاح|تفجير|كراهية|إيذاء/,
  // Prompt injection patterns
  /ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/i,
  /system\s*prompt/i,
  /you\s+are\s+(now|a)\b/i,
  /\boverride\b/i,
  /forget\s+(everything|all|your)/i,
  /act\s+as\s+(if|a)\b/i,
  /\bdo\s+not\s+follow\b/i,
  /respond\s+in\s+english/i,
  /تجاهل\s+التعليمات/,
  /\bjailbreak\b/i,
  /\bDAN\b/,
];

/**
 * Sanitizes a single wish string.
 * Removes control characters and excessive whitespace.
 */
function sanitizeWish(wish: string): string {
  return wish
    .replace(/[\x00-\x1F\x7F]/g, "") // strip control chars
    .replace(/[<>{}[\]]/g, "")        // strip structural chars (anti-injection)
    .replace(/\s+/g, " ")             // collapse whitespace
    .trim();
}

/**
 * Checks a wish against blocked content patterns.
 * Returns true if the content is flagged as harmful.
 */
function isFlagged(wish: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(wish));
}

/**
 * Stage 1: Preprocessing Pipeline
 *
 * Accepts raw wish strings and returns a validated, sanitized input
 * ready for LLM consumption. Enforces all safety and structural constraints.
 */
export function preprocessWishes(rawWishes: unknown): PreprocessingResult {
  // ── Type guard ──
  if (!Array.isArray(rawWishes)) {
    return { success: false, error: "يجب إرسال الرغبات كقائمة" };
  }

  // ── Sanitize & filter ──
  const sanitized: string[] = rawWishes
    .filter((w): w is string => typeof w === "string")
    .map(sanitizeWish)
    .filter((w) => w.length > 0);

  if (sanitized.length === 0) {
    return { success: false, error: "يرجى إدخال رغبة واحدة على الأقل" };
  }

  // ── Enforce max wishes ──
  if (sanitized.length > MAX_WISHES) {
    return {
      success: false,
      error: `الحد الأقصى ${MAX_WISHES} رغبات فقط`,
    };
  }

  // ── Enforce max length per wish ──
  const tooLong = sanitized.find((w) => w.length > MAX_WISH_LENGTH);
  if (tooLong) {
    return {
      success: false,
      error: `كل رغبة يجب ألا تتجاوز ${MAX_WISH_LENGTH} حرفاً`,
    };
  }

  // ── Content moderation ──
  const flagged = sanitized.find(isFlagged);
  if (flagged) {
    return {
      success: false,
      error: "تم رفض الطلب لاحتوائه على محتوى غير مناسب",
    };
  }

  // ── Build validated output ──
  const validated: ValidatedInput = {
    wishes: sanitized,
    wishCount: sanitized.length,
    timestamp: new Date().toISOString(),
  };

  return { success: true, data: validated };
}
