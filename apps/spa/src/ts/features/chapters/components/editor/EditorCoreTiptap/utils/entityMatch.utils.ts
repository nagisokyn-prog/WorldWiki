/**
 * Calculates Levenshtein edit distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,       // deletion
        dp[j - 1] + 1,   // insertion
        prev + cost      // substitution
      );
      prev = temp;
    }
  }

  return dp[n];
}

/**
 * Computes fuzzy similarity between two strings in [0, 1] range.
 * Uses exact match, substring inclusion, and normalized Levenshtein distance.
 */
export function computeSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Substring inclusion gives high base similarity
  if (a.includes(b) || b.includes(a)) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return Math.max(0.6, ratio);
  }

  // Levenshtein-based similarity
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}
