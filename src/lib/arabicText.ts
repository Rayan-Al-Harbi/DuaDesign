/**
 * Shared Arabic text helpers.
 *
 * Comparing dua text needs a normalized form: the model varies tashkeel, alef
 * and taa-marbuta spelling between two emissions of the same sentence, so a
 * raw string compare misses repetitions that a reader plainly sees as repeated.
 */

// Built from code points rather than written inline, because the diacritic
// range is made of invisible combining marks that do not survive an editor
// round-trip intact. U+0600-U+06FF Arabic block, U+064B-U+0652 tashkeel,
// U+0670 superscript alef, U+0640 tatweel.
const cp = String.fromCharCode;
const ARABIC_RANGE = `${cp(0x0600)}-${cp(0x06ff)}`;
const DIACRITICS = new RegExp(`[${cp(0x064b)}-${cp(0x0652)}${cp(0x0670)}${cp(0x0640)}]`, "g");
const NON_ARABIC = new RegExp(`[^${ARABIC_RANGE}\\s]`, "g");
const ARABIC_CHAR = new RegExp(`[${ARABIC_RANGE}]`, "g");

/** Collapse an Arabic string to a form safe for equality comparison. */
export function normalizeArabic(s: string): string {
  return s
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا") // alef variants -> bare alef
    .replace(/ة/g, "ه") // taa marbuta -> haa
    .replace(/ى/g, "ي") // alef maqsura -> yaa
    .replace(NON_ARABIC, " ") // drop punctuation, latin, emoji
    .replace(/\s+/g, " ")
    .trim();
}

/** Number of Arabic-script characters in a string. */
export function countArabicChars(text: string): number {
  return (text.match(ARABIC_CHAR) || []).length;
}

/**
 * Split into comparable segments. Prefers sentence enders; falls back to commas
 * when the model returns one long run-on paragraph, so a duplicated block is
 * still detectable.
 */
export function splitSegments(text: string): string[] {
  const bySentence = text
    .split(/(?<=[.!؟؛])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (bySentence.length >= 3) return bySentence;

  return text
    .split(/(?<=[،,])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
