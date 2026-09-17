import type { GeneratedDua, ValidationResult } from "@/types/dua";
import { countArabicChars, normalizeArabic } from "@/lib/arabicText";

// Phrase length (in words) used to spot a looping generation. Long enough that
// ordinary dua formulae do not trip it.
const REPEAT_PHRASE_WORDS = 6;
const REPEAT_RATIO_LIMIT = 0.15;

/**
 * Backstop for repetition that survived deduplication — the model weaving the
 * same phrase through differently-worded sentences, which exact-segment
 * matching cannot catch. Flagging it here lets the pipeline retry.
 */
function isRepetitive(text: string): boolean {
  const words = normalizeArabic(text).split(" ").filter(Boolean);
  const positions = words.length - REPEAT_PHRASE_WORDS + 1;
  if (positions < REPEAT_PHRASE_WORDS * 2) return false;

  const seen = new Set<string>();
  let repeats = 0;
  for (let i = 0; i < positions; i++) {
    const phrase = words.slice(i, i + REPEAT_PHRASE_WORDS).join(" ");
    if (seen.has(phrase)) repeats++;
    else seen.add(phrase);
  }
  return repeats / positions > REPEAT_RATIO_LIMIT;
}

export function validateDua(dua: GeneratedDua): ValidationResult {
  const errors: string[] = [];
  if (!dua.text || dua.text.trim().length < 30) errors.push("الدعاء قصير جداً");
  if (/[a-zA-Z]{3,}/.test(dua.text)) errors.push("يحتوي على كلمات إنجليزية");
  if (countArabicChars(dua.text) < 20) errors.push("نص عربي غير كافٍ");

  // Repetition is a quality signal, not a fault: a slightly repetitive dua is
  // still worth showing, so it earns a retry rather than failing the request.
  const warnings: string[] = [];
  if (dua.text && isRepetitive(dua.text)) warnings.push("تكرار مفرط في النص");

  return { isValid: errors.length === 0, errors, warnings };
}
