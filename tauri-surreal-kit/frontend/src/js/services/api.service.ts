/**
 * @file api.service.ts — tauri-surreal-kit core
 * @description Framework-level Tauri invoke wrapper.
 *
 * Provides:
 *  - isTauri flag
 *  - invoke() with browser-mock fallback
 *  - stringifyId()  — normalises SurrealDB RecordId to "table:id" string
 *  - processIds()   — deep-walks any object/array and normalises all id fields
 *  - uploadPhoto()  — uploads image bytes via Tauri
 *  - getLocalFile() — reads a local file via Tauri
 *
 * Domain-specific commands (getEntity, saveChapter, etc.) live in the
 * consuming app's own api layer which imports and wraps invoke() from here.
 */

// ─── Tauri detection ──────────────────────────────────────────────────────────

export const isTauri: boolean =
  typeof window !== 'undefined' && !!(window as any).__TAURI__?.core;

// ─── invoke() with browser-mock fallback ─────────────────────────────────────

type InvokeFn = <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

export const invoke: InvokeFn = isTauri
  ? (cmd, args) => (window as any).__TAURI__.core.invoke(cmd, args)
  : async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
      console.warn(`[API Mock] ${cmd}`, args);
      // Extend in your app's own mock layer as needed:
      switch (cmd) {
        case 'load_settings': return null as any as T;
        case 'save_settings': return null as any as T;
        case 'run_performance_benchmark':
          return { level: 'high', cpu_score: 50, memory_mb: 100, cores: 8 } as any as T;
        case 'get_performance_styles': return '' as any as T;
        case 'get_custom_themes': return [] as any as T;
        case 'load_theme': return null as any as T;
        default: return null as any as T;
      }
    };

// ─── SurrealDB RecordId normalisation ────────────────────────────────────────

/**
 * Normalise any SurrealDB id representation to a plain "table:id" string.
 * Handles: string, { tb, id }, { String: "..." }, { Int: 42 }, { Uuid: "..." }
 */
export const stringifyId = (val: unknown): string => {
  if (val === null || val === undefined) return '';

  if (typeof val === 'string') {
    let s = val;
    // Strip leftover SurrealDB wrapper that leaked into a string
    if (s.includes('{String:')) {
      s = s.replace(/.*String:"?([^"]+)"?.*/, '$1');
    }
    return s.replace(/"/g, '').normalize('NFC').trim();
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;

    // { tb: "table", id: ... }  — standard RecordId
    if (obj.tb) {
      let actualId = obj.id;
      if (actualId && typeof actualId === 'object') {
        const inner = actualId as Record<string, unknown>;
        actualId = inner.String ?? inner.Int ?? inner.Uuid ?? JSON.stringify(actualId);
      }
      return `${obj.tb}:${String(actualId).replace(/[\"⟨⟩]/g, '')}`.normalize('NFC').trim();
    }

    // { String: "..." }
    if (obj.String) {
      return String(obj.String).replace(/[\"⟨⟩]/g, '').normalize('NFC').trim();
    }
  }

  return String(val).replace(/[\"⟨⟩]/g, '').normalize('NFC').trim();
};

/**
 * Recursively walk an object/array and replace all "id"-like fields with
 * their normalised string form using stringifyId().
 */
export const processIds = (data: unknown): any => {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(item => processIds(item));
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      // Normalise any key that looks like a SurrealDB RecordId object
      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        ('tb' in (val as object) || 'String' in (val as object))
      ) {
        result[key] = stringifyId(val);
      } else {
        result[key] = processIds(val);
      }
    }
    return result;
  }

  return data;
};

// ─── System commands ──────────────────────────────────────────────────────────

/**
 * Upload image bytes to the backend → returns the absolute local path.
 */
export const uploadPhoto = async (bytes: number[], filename: string): Promise<string> => {
  return invoke('upload_photo', { bytes, filename }) as Promise<string>;
};

/**
 * Read a local file from disk (used to serve local images inside the webview).
 */
export const getLocalFile = async (path: string): Promise<number[]> => {
  return invoke('get_local_file', { path }) as Promise<number[]>;
};

// ─── Global convenience (legacy compat) ──────────────────────────────────────

declare global {
  interface Window {
    __TSK_INVOKE__: InvokeFn;
    __TSK_STRINGIFY_ID__: typeof stringifyId;
  }
}

if (typeof window !== 'undefined') {
  window.__TSK_INVOKE__       = invoke;
  window.__TSK_STRINGIFY_ID__ = stringifyId;
}
