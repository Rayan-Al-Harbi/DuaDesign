import type { GeneratedDua, ValidationResult } from "@/types/dua";

export function validateDua(dua: GeneratedDua): ValidationResult {
  const errors: string[] = [];
  if (!dua.text || dua.text.trim().length < 30) errors.push("الدعاء قصير جداً");
  if (/[a-zA-Z]{3,}/.test(dua.text)) errors.push("يحتوي على كلمات إنجليزية");
  if ((dua.text.match(/[\u0600-\u06FF]/g) || []).length < 20) errors.push("نص عربي غير كافٍ");
  return { isValid: errors.length === 0, errors };
}
