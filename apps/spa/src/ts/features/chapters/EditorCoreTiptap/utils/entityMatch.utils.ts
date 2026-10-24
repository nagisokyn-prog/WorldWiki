export function computeSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }
  if (a.length < 2 || b.length < 2) return 0;
  let matches = 0;
  for (let i = 0; i < a.length - 1; i++) {
    if (b.includes(a.slice(i, i + 2))) matches++;
  }
  return (2 * matches) / ((a.length - 1) + (b.length - 1));
}
