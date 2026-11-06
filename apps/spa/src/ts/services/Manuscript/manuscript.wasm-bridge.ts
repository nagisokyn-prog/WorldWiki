/**
 * @file manuscript.wasm-bridge.ts
 * @description Мост методов WASM-движка рукописи (FSM парсинг сущностей и кросс-ссылки) для Vue 3.
 * Обеспечивает мгновенный доступ в браузере и тестовом окружении Node/Vitest.
 */

import initWasm, {
  WasmManuscriptEngine,
  initSync,
  type ExtractedEntityMention,
  type CrossReference,
  type ResolvedCrossReference,
  type TargetMetadata,
} from '@worldwiki/manuscript-wasm';
import wasmUrl from '../../../../../../packages/manuscript-wasm/pkg/worldwiki_manuscript_wasm_bg.wasm?url';

interface NodeFsModule {
  existsSync(path: string): boolean;
  readFileSync(path: string): Uint8Array;
}
interface NodePathModule {
  resolve(...paths: string[]): string;
}

declare const require: ((id: string) => unknown) | undefined;
declare const process: { versions?: { node?: string }; cwd?: () => string; getBuiltinModule?: (id: string) => unknown } | undefined;
declare const __dirname: string | undefined;

let wasmEngineInstance: WasmManuscriptEngine | null = null;
let wasmInitPromise: Promise<void> | null = null;
let isWasmInitialized = false;

export function isManuscriptWasmReady(): boolean {
  return isWasmInitialized && wasmEngineInstance !== null;
}

export async function ensureManuscriptWasm(): Promise<WasmManuscriptEngine> {
  if (wasmEngineInstance) return wasmEngineInstance;
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      try {
        await initWasm({ module_or_path: wasmUrl });
        wasmEngineInstance = new WasmManuscriptEngine();
        isWasmInitialized = true;
      } catch (err) {
        console.warn('[manuscript.wasm-bridge] WASM initialization failed, using JS fallback:', err);
      }
    })();
  }
  await wasmInitPromise;
  return wasmEngineInstance!;
}

export function getManuscriptEngine(): WasmManuscriptEngine | null {
  if (!wasmEngineInstance) {
    try {
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
          let fs: NodeFsModule | undefined;
          let path: NodePathModule | undefined;

          if (typeof require === 'function') {
            fs = require('fs') as NodeFsModule;
            path = require('path') as NodePathModule;
          }
          if (!fs && typeof process.getBuiltinModule === 'function') {
            fs = process.getBuiltinModule('fs') as NodeFsModule;
            path = process.getBuiltinModule('path') as NodePathModule;
          }
          if (fs && path) {
            const cwd = typeof process.cwd === 'function' ? process.cwd() : '.';
            const dir = typeof __dirname !== 'undefined' ? __dirname : '';
            const candidates = [
              dir ? path.resolve(dir, '../../../../../../packages/manuscript-wasm/pkg/worldwiki_manuscript_wasm_bg.wasm') : '',
              path.resolve(cwd, 'packages/manuscript-wasm/pkg/worldwiki_manuscript_wasm_bg.wasm'),
              path.resolve(cwd, '../../packages/manuscript-wasm/pkg/worldwiki_manuscript_wasm_bg.wasm'),
            ].filter(Boolean);
            for (const cand of candidates) {
              if (fs.existsSync(cand)) {
                const buffer = fs.readFileSync(cand);
                initSync({ module: buffer });
                wasmEngineInstance = new WasmManuscriptEngine();
                isWasmInitialized = true;
                return wasmEngineInstance;
              }
            }
          }
        } catch (err) {
          console.debug('[manuscript.wasm-bridge] Node.js sync WASM fallback unavailable:', err);
        }
      }
      if (isWasmInitialized) {
        wasmEngineInstance = new WasmManuscriptEngine();
      } else {
        return null;
      }
    } catch (err) {
      console.debug('[manuscript.wasm-bridge] WASM module not yet ready:', err);
      return null;
    }
  }
  return wasmEngineInstance;
}

/**
 * Извлекает все упоминания сущностей вида ((Имя)) из текста рукописи.
 * Если WASM готов — использует Rust FSM-лексер. Иначе — JS fallback.
 */
export function extractEntityMentions(text: string): ExtractedEntityMention[] {
  const engine = getManuscriptEngine();
  if (engine) {
    try {
      return engine.extract_entities(text) as ExtractedEntityMention[];
    } catch (err) {
      console.warn('[manuscript.wasm-bridge] extract_entities error:', err);
    }
  }

  // JS Fallback
  const results: ExtractedEntityMention[] = [];
  const regex = /\(\((.*?)\)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const rawName = match[1].trim();
    if (rawName) {
      results.push({
        name: rawName,
        byte_start: match.index,
        byte_end: match.index + match[0].length,
        char_start: match.index,
        char_end: match.index + match[0].length,
      });
    }
  }
  return results;
}

/**
 * Резолвит пакет кросс-ссылок против индекса метаданных сущностей.
 */
export function resolveCrossReferences(
  references: CrossReference[],
  index: Record<string, TargetMetadata>
): ResolvedCrossReference[] {
  const engine = getManuscriptEngine();
  if (engine) {
    try {
      return engine.resolve_cross_references(references, index) as ResolvedCrossReference[];
    } catch (err) {
      console.warn('[manuscript.wasm-bridge] resolve_cross_references error:', err);
    }
  }

  // JS Fallback
  return references.map((ref) => {
    const meta = index[ref.target_id];
    return {
      ref_id: ref.id,
      target_id: ref.target_id,
      is_resolved: !!meta,
      target_title: meta?.title,
      target_path: meta?.path,
    };
  });
}

export type {
  ExtractedEntityMention,
  CrossReference,
  ResolvedCrossReference,
  TargetMetadata,
};

