// ─────────────────────────────────────────────────────────────
// Scripture Guard — keeps invented Quran and hadith out of the output
//
// The prompt forbids presenting text as scripture, but a 7B model asked for
// devotional Arabic will still reach for "قال تعالى" and then invent what
// follows. Telling it not to is prevention; this is enforcement.
// ─────────────────────────────────────────────────────────────

import type { DuaReference } from "@/data/duaKnowledgeBase";
import { normalizeArabic } from "@/lib/arabicText";

const cp = String.fromCharCode;

// Optional diacritics between letters. Generated output carries tashkeel, so a
// pattern written as plain letters never matches: "مَن" is م + fatha + ن.
const TASHKEEL = `[${cp(0x064b)}-${cp(0x0652)}${cp(0x0670)}${cp(0x0640)}]*`;

// Ornate parentheses, used almost exclusively to mark Quranic quotation.
// U+FD3F is the visually opening bracket and U+FD3E the closing one, despite
// their Unicode names reading the other way round.
const ORNATE_OPEN = cp(0xfd3f);
const ORNATE_CLOSE = cp(0xfd3e);
const ORNATE_CLASS = `[${ORNATE_OPEN}${ORNATE_CLOSE}]`;

// Matched against either orientation: the model emits mismatched pairs such as
// "﴾ ﴿...﴾", so anchoring to a correctly ordered pair would miss the worst
// output.
const ORNATE_SPAN = new RegExp(`${ORNATE_CLASS}\\s*([^${ORNATE_OPEN}${ORNATE_CLOSE}]+?)\\s*${ORNATE_CLASS}`, "g");
const ORNATE_ANY = new RegExp(ORNATE_CLASS, "g");

/** Quotation marks the model uses to set scripture apart. */
const QUOTED_SPAN = /["'«»“”]([^"'«»“”\n]{10,})["'«»“”]/g;
const QUOTE_CHARS = /["'«»“”]/g;

/**
 * Phrases that present what follows as the speech of Allah or the Prophet.
 * Written plainly and compiled below; longest first, so "يا من قلت وقولك الحق"
 * is consumed whole rather than leaving a dangling "يا من".
 */
const ATTRIBUTION_PHRASES = [
  "يا من قلت وقولك الحق",
  "من قلت وقولك الحق",
  "قلت وقولك الحق",
  "كما قلت في كتابك",
  "في كتابك العزيز",
  "في كتابك الكريم",
  "قال الله تعالى",
  "في الحديث القدسي",
  "في الحديث الشريف",
  "قال رسول الله",
  "وقولك الحق",
  "قولك الحق",
  "قال تعالى",
  "قوله تعالى",
  "قال النبي",
  "يا من قلت",
];

/** Compile a plain Arabic phrase into a diacritic- and spacing-tolerant pattern. */
function phrasePattern(phrase: string): RegExp {
  const body = phrase
    .split(/\s+/)
    .map((word) => word.split("").join(TASHKEEL))
    .join("\\s+");
  // Trailing colon or comma belongs to the framing, not the sentence.
  return new RegExp(`${body}${TASHKEEL}\\s*[:،]?`, "g");
}

const ATTRIBUTIONS = ATTRIBUTION_PHRASES.map(phrasePattern);

export interface ScriptureScan {
  /** Text with attribution framing and quotation styling removed. */
  text: string;
  /** How many attribution phrases were stripped. */
  attributions: number;
  /** Quoted spans that match nothing in the retrieved corpus. */
  unverified: string[];
}

/** Whether a quoted span corresponds to something we actually retrieved. */
function isKnown(span: string, references: DuaReference[]): boolean {
  const needle = normalizeArabic(span);
  if (needle.length < 10) return true; // too short to be a scripture claim

  return references.some((ref) => {
    const hay = normalizeArabic(ref.text);
    return hay.includes(needle) || needle.includes(hay);
  });
}

/**
 * Strip scripture framing and report anything quoted that we cannot vouch for.
 *
 * Stripping rather than rejecting is deliberate. These reference texts are
 * supplications meant to be said, not quoted, so removing the framing turns a
 * false attribution back into an ordinary petition — which is both the
 * theologically correct form and the safest thing to show a user. The
 * unverified list still flags the generation as low quality so the pipeline
 * can ask the model for a cleaner one.
 */
export function scanScripture(raw: string, references: DuaReference[]): ScriptureScan {
  const unverified: string[] = [];

  for (const [, span] of raw.matchAll(ORNATE_SPAN)) {
    if (span.trim() && !isKnown(span, references)) unverified.push(span.trim());
  }
  for (const [, span] of raw.matchAll(QUOTED_SPAN)) {
    if (!isKnown(span, references)) unverified.push(span.trim());
  }

  let text = raw;
  let attributions = 0;
  for (const pattern of ATTRIBUTIONS) {
    text = text.replace(pattern, () => { attributions++; return ""; });
  }

  // A span we can vouch for is an authentic supplication and stays, stripped of
  // its quotation styling. One we cannot is dropped outright: unframing it
  // would leave invented scripture sitting in the dua as ordinary text. The
  // surrounding petition survives either way, so removing the span costs a
  // clause rather than the sentence.
  const resolveSpan = (_full: string, span: string) => (isKnown(span, references) ? span : "");

  text = text
    .replace(ORNATE_SPAN, resolveSpan)
    .replace(QUOTED_SPAN, resolveSpan)
    .replace(ORNATE_ANY, "")
    .replace(QUOTE_CHARS, "")
    // Stripping a span strands its punctuation and doubles its spaces. These
    // use [ \t] rather than \s throughout: \s matches newlines, which glued
    // separate lines together and left a full stop touching a comma.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([،.؛])/g, "$1")
    .replace(/([.؛])[ \t]*،/g, "$1")
    .replace(/،[ \t]*،/g, "،")
    .replace(/^[ \t،:.]+/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, attributions, unverified };
}
