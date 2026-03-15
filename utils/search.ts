/** Shared hybrid-search utilities used by ContentLibraryView and AssistantView. */

/** Strips common markdown characters before tokenisation. */
export const stripMd = (t: string): string => t.replace(/[*_`~[\]#>]/g, ' ');

/**
 * BM25-lite keyword relevance score (no pre-computed IDF, result normalised to ~[0,1]).
 * Supports partial token matching (token.includes(term)).
 */
export const bm25Score = (query: string, docText: string): number => {
    const k1 = 1.5;
    const b = 0.75;
    const avgDocLen = 25;

    const queryTerms = stripMd(query).toLowerCase().split(/[\s,.\-/]+/).filter(Boolean);
    const docTokens  = stripMd(docText).toLowerCase().split(/[\s,.\-/]+/).filter(Boolean);
    const docLen     = docTokens.length || 1;

    let score = 0;
    for (const term of queryTerms) {
        const tf = docTokens.filter(t => t === term || t.includes(term)).length;
        if (tf > 0) {
            score += (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgDocLen));
        }
    }
    return score / Math.max(queryTerms.length, 1);
};

/** Cosine similarity between two equal-length vectors. Returns 0 for mismatched/empty inputs. */
export const cosineSimilarity = (a: number[], b: number[]): number => {
    if (!a || !b || a.length !== b.length || a.length === 0) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot   += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
};

/** Hybrid ranking: 60 % semantic cosine + 40 % BM25 keyword. */
export const hybridScore = (cosine: number, bm25: number): number =>
    0.6 * cosine + 0.4 * Math.min(bm25, 1);
