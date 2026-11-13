/**
 * Deeply merges `source` properties into `target` in place, syncing array lengths.
 */
export function deepMergeRecord(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): void {
  for (const key in source) {
    const val = source[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMergeRecord(target[key] as Record<string, unknown>, val as Record<string, unknown>);
    } else if (Array.isArray(val)) {
      if (!Array.isArray(target[key])) {
        target[key] = [];
      }
      const tArr = target[key] as unknown[];
      for (let i = 0; i < val.length; i++) {
        if (i < tArr.length && typeof val[i] === 'object' && val[i] !== null) {
          deepMergeRecord(tArr[i] as Record<string, unknown>, val[i] as Record<string, unknown>);
        } else if (i < tArr.length) {
          tArr[i] = val[i];
        } else {
          tArr.push(val[i]);
        }
      }
      tArr.length = val.length;
    } else {
      target[key] = val;
    }
  }
}

