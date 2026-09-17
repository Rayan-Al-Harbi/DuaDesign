// ─────────────────────────────────────────────────────────────
// Topic Matcher — Maps user wishes to dua knowledge categories
//
// Retrieves authentic dua references for context injection, grouped by the
// wish each one serves so the prompt can tie them together.
// ─────────────────────────────────────────────────────────────

import { DUA_KNOWLEDGE_BASE, type DuaCategory, type DuaReference } from "@/data/duaKnowledgeBase";
import { matchesKeyword, tokenize } from "@/lib/arabicText";

/** Authentic references retrieved for one wish. */
export interface WishContext {
  wish: string;
  categories: string[];
  references: DuaReference[];
}

export interface MatchedContext {
  /** References grouped by the wish they were retrieved for. */
  perWish: WishContext[];
  /** Every retrieved reference, deduplicated — the set quoting is checked against. */
  references: DuaReference[];
  /** Category IDs that were matched. */
  matchedCategories: string[];
}

// A small, focused context beats a large one on a 7B model: with fifteen
// references it drifts between them instead of using any. These caps keep the
// prompt tied to what the user actually asked for.
const CATEGORIES_PER_WISH = 2;
const REFERENCES_PER_WISH = 3;
const GENERAL_REFERENCES = 2;

/** Score categories for one wish by how many distinct keywords it hits. */
function matchWish(wish: string): DuaCategory[] {
  const words = tokenize(wish);

  return DUA_KNOWLEDGE_BASE
    .filter((cat) => cat.keywords.length > 0) // skip "general"
    .map((cat) => ({
      category: cat,
      hits: cat.keywords.filter((kw) => words.some((w) => matchesKeyword(w, kw))).length,
    }))
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, CATEGORIES_PER_WISH)
    .map((s) => s.category);
}

/**
 * Retrieve authentic references for every wish.
 *
 * General references are appended as a baseline so a wish that matches no
 * category still has authentic wording to draw on.
 */
export function matchTopics(wishes: string[]): MatchedContext {
  const seen = new Set<string>();
  const perWish: WishContext[] = [];
  const flat: DuaReference[] = [];
  const matchedCategoryIds = new Set<string>();

  const take = (ref: DuaReference): boolean => {
    if (seen.has(ref.text)) return false;
    seen.add(ref.text);
    flat.push(ref);
    return true;
  };

  for (const wish of wishes) {
    const categories = matchWish(wish);
    const references: DuaReference[] = [];

    for (const cat of categories) {
      matchedCategoryIds.add(cat.id);
      for (const ref of cat.references) {
        if (references.length >= REFERENCES_PER_WISH) break;
        if (take(ref)) references.push(ref);
      }
    }

    perWish.push({ wish, categories: categories.map((c) => c.id), references });
  }

  const general = DUA_KNOWLEDGE_BASE.find((c) => c.id === "general");
  const generalRefs: DuaReference[] = [];
  if (general) {
    for (const ref of general.references) {
      if (generalRefs.length >= GENERAL_REFERENCES) break;
      if (take(ref)) generalRefs.push(ref);
    }
  }

  // A wish that matched nothing still needs wording to work from.
  for (const entry of perWish) {
    if (entry.references.length === 0) entry.references = generalRefs;
  }

  console.log(
    `[TopicMatcher] ${matchedCategoryIds.size} categories, ${flat.length} references for ${wishes.length} wishes`
  );

  return { perWish, references: flat, matchedCategories: Array.from(matchedCategoryIds) };
}
