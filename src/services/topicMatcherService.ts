// ─────────────────────────────────────────────────────────────
// Topic Matcher — Maps user wishes to dua knowledge categories
//
// Uses keyword matching to find relevant authentic dua references
// for context injection into the LLM prompt.
// ─────────────────────────────────────────────────────────────

import { DUA_KNOWLEDGE_BASE, type DuaCategory, type DuaReference } from "@/data/duaKnowledgeBase";

export interface MatchedContext {
  /** All unique references matched across all wishes */
  references: DuaReference[];
  /** Category IDs that were matched */
  matchedCategories: string[];
}

/**
 * Matches a single wish against all categories.
 * Returns matching categories sorted by relevance (keyword hit count).
 */
function matchWish(wish: string): DuaCategory[] {
  const normalizedWish = wish.toLowerCase().trim();

  const scored = DUA_KNOWLEDGE_BASE
    .filter((cat) => cat.keywords.length > 0) // skip "general"
    .map((cat) => {
      const hits = cat.keywords.filter((kw) =>
        normalizedWish.includes(kw.toLowerCase())
      ).length;
      return { category: cat, hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  return scored.map((s) => s.category);
}

/**
 * Matches all user wishes against the knowledge base.
 * Returns deduplicated, relevant dua references for context injection.
 *
 * Always includes "general" category references as a baseline.
 * Caps total references to avoid prompt bloat.
 */
export function matchTopics(wishes: string[]): MatchedContext {
  const seenTexts = new Set<string>();
  const references: DuaReference[] = [];
  const matchedCategoryIds = new Set<string>();

  // Match each wish
  for (const wish of wishes) {
    const categories = matchWish(wish);

    for (const cat of categories) {
      matchedCategoryIds.add(cat.id);

      for (const ref of cat.references) {
        if (!seenTexts.has(ref.text)) {
          seenTexts.add(ref.text);
          references.push(ref);
        }
      }
    }
  }

  // Always add general references
  const general = DUA_KNOWLEDGE_BASE.find((c) => c.id === "general");
  if (general) {
    for (const ref of general.references) {
      if (!seenTexts.has(ref.text)) {
        seenTexts.add(ref.text);
        references.push(ref);
      }
    }
  }

  // Cap at 15 references to keep prompt focused
  const capped = references.slice(0, 15);

  console.log(
    `[TopicMatcher] Matched ${matchedCategoryIds.size} categories, ${capped.length} references for ${wishes.length} wishes`
  );

  return {
    references: capped,
    matchedCategories: Array.from(matchedCategoryIds),
  };
}
