export function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((cur: any, k: string) => (cur != null ? cur[k] : undefined), obj);
}

export function setValueByPath(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}