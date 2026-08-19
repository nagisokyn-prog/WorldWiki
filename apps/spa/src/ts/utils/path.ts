export function getValueByPath(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, k) => {
    if (cur != null && typeof cur === 'object') {
      return (cur as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

export function setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!cur[part] || typeof cur[part] !== 'object') {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}