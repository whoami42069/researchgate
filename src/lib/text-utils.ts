/**
 * Shared text utilities for relevancy optimization.
 * Used by pre-filter (search), query diversity (analyze), and calibration anchors (prompts).
 */

export const STOP_WORDS = new Set([
    // Common English
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
    "her", "was", "one", "our", "out", "has", "his", "how", "its", "may",
    "new", "now", "old", "see", "way", "who", "did", "get", "let", "say",
    "she", "too", "use", "been", "each", "have", "this", "that", "with",
    "will", "from", "they", "been", "more", "when", "some", "than", "them",
    "into", "only", "over", "such", "also", "back", "very", "just", "about",
    "could", "would", "should", "these", "those", "their", "which", "where",
    "there", "other", "after", "between", "through", "before", "during",
    // Academic filler
    "study", "research", "paper", "article", "review", "analysis", "results",
    "findings", "data", "method", "methods", "approach", "using", "based",
    "effect", "effects", "impact", "role", "among", "within", "across",
    "associated", "related", "significant", "showed", "found", "suggests",
    "examined", "investigated", "explored", "aimed", "objective", "purpose",
    "conclusion", "conclusions", "background", "introduction",
]);

/**
 * Tokenize text into a Set of lowercase words, stripping punctuation.
 * Skips words shorter than 3 characters.
 */
export function tokenize(text: string): Set<string> {
    if (!text) return new Set();
    const words = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, " ")
        .split(/\s+/)
        .filter(w => w.length >= 3);
    return new Set(words);
}

/**
 * Tokenize for relevancy: tokenize + remove stop words.
 */
export function tokenizeForRelevancy(text: string): Set<string> {
    const tokens = tokenize(text);
    const filtered = new Set<string>();
    for (const t of tokens) {
        if (!STOP_WORDS.has(t)) {
            filtered.add(t);
        }
    }
    return filtered;
}

/**
 * Jaccard similarity: |intersection| / |union| of two Sets.
 * Returns 0 if both sets are empty.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let intersection = 0;
    const smaller = a.size <= b.size ? a : b;
    const larger = a.size <= b.size ? b : a;
    for (const item of smaller) {
        if (larger.has(item)) intersection++;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
