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

// Arabic punctuation sits inside the Arabic block, so NON_ARABIC leaves it
// behind. Strip it separately, or the same sentence re-emitted with a comma
// instead of a full stop reads as two different segments.
// U+060C comma, U+061B semicolon, U+061F question mark, U+066A-U+066D
// percent/decimal/thousands/star, U+06D4 full stop.
const ARABIC_PUNCT = new RegExp(
  `[${cp(0x060c)}${cp(0x061b)}${cp(0x061f)}${cp(0x066a)}-${cp(0x066d)}${cp(0x06d4)}]`,
  "g"
);

/** Collapse an Arabic string to a form safe for equality comparison. */
export function normalizeArabic(s: string): string {
  return s
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا") // alef variants -> bare alef
    .replace(/ة/g, "ه") // taa marbuta -> haa
    .replace(/ى/g, "ي") // alef maqsura -> yaa
    .replace(ARABIC_PUNCT, " ")
    .replace(NON_ARABIC, " ") // latin, emoji, western punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/** Number of Arabic-script characters in a string. */
export function countArabicChars(text: string): number {
  return (text.match(ARABIC_CHAR) || []).length;
}

/**
 * Split into comparable segments on both sentence enders and commas. Commas
 * count because the model often re-states a petition as a clause rather than a
 * sentence, which a sentence-only split hides inside one segment. Splitting
 * this finely is safe: segments are deduplicated only on exact equality after
 * normalization, so clauses that merely resemble each other all survive.
 */
export function splitSegments(text: string): string[] {
  return text
    .split(/(?<=[.!؟؛،,])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
