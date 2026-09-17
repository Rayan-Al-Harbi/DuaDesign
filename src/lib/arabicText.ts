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

// Clitics that attach to the front of an Arabic word, longest first.
//
// Verb prefixes (ي ت ن أ) are excluded because stripping them collides with
// ordinary nouns; keyword lists carry verb forms explicitly instead. The
// conjunctions و and ف are excluded for a sharper reason: they are part of
// real words. Stripping them turned "والدين" into "دين", which then matched
// "ديني" and retrieved parent duas for a wish about faith — and it split the
// one word family four ways ("والد"→"الد" but "الوالدين"→"والد"), so the
// over-stripping did not cancel out between the two sides of a comparison.
const CLITIC_PREFIXES = ["بال", "كال", "لل", "ال", "ب", "ك", "ل"];

// Pronoun and plural endings, longest first.
const SUFFIXES = ["هما", "كما", "هم", "هن", "كم", "كن", "نا", "ها", "ات", "ون", "ين", "ان", "ه", "ك", "ي"];

const MIN_STEM = 3;

// The definite article strips down further than other affixes. Arabic has real
// two-letter roots — حج, أم, أب — and holding them to MIN_STEM left "الحج"
// unstripped, so a wish about Hajj matched no category at all.
const MIN_STEM_AFTER_ARTICLE = 2;
const ARTICLES = new Set(["ال", "بال", "كال", "لل"]);

/**
 * Strip one leading clitic and one trailing affix, leaving a crude stem.
 *
 * This is not a linguistic stemmer and does not try to be. It over-strips
 * words that merely begin with a clitic ("كتاب" loses its ك), which is
 * tolerable only as long as it over-strips every form of a word the same way —
 * both sides of a comparison run through it, so a consistent error cancels
 * out. An affix that fires on some forms of a word and not others does real
 * damage, which is why the prefix list is as short as it is. It never strips
 * below MIN_STEM characters, which keeps short keywords from matching
 * everything.
 */
export function stemArabic(word: string): string {
  let w = normalizeArabic(word);

  for (const p of CLITIC_PREFIXES) {
    const floor = ARTICLES.has(p) ? MIN_STEM_AFTER_ARTICLE : MIN_STEM;
    if (w.startsWith(p) && w.length - p.length >= floor) {
      w = w.slice(p.length);
      break;
    }
  }
  for (const s of SUFFIXES) {
    if (w.endsWith(s) && w.length - s.length >= MIN_STEM) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  return w;
}

/** Split text into normalized word tokens. */
export function tokenize(text: string): string[] {
  return normalizeArabic(text).split(" ").filter(Boolean);
}

/**
 * Whether a word from the user's wish refers to the same thing as a keyword.
 *
 * Anchored at the start of the stem rather than searching anywhere inside it,
 * so "المدينة" no longer matches "دين" and "الاختبارات" no longer matches
 * "بار" — substring matching pulled debt duas into pilgrimage wishes and
 * child-rearing duas into exam wishes.
 */
export function matchesKeyword(word: string, keyword: string): boolean {
  const t = stemArabic(word);
  const k = stemArabic(keyword);
  if (!t || !k) return false;
  if (t === k) return true;

  // A two-letter stem must match exactly. Allowing it a couple of trailing
  // characters made it match most of the lexicon: "أب" (father) stems to "اب"
  // and swallowed the colloquial "ابغى" ("I want"), retrieving parent duas for
  // any wish phrased in dialect.
  if (k.length < MIN_STEM) return false;

  if (t.startsWith(k) && t.length - k.length <= 2) return true;
  if (k.startsWith(t) && k.length - t.length <= 2) return true;
  return false;
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
