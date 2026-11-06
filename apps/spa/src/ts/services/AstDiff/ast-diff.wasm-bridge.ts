/**
 * @file ast-diff.wasm-bridge.ts
 * @description Мост методов WASM-движка AST Myers diff & patch для Vue 3.
 * Обеспечивает мгновенный доступ к сравнению SemanticDocument в браузере и тестовом окружении Node/Vitest.
 */

import initWasm, {
  WasmAstDiffEngine,
  initSync,
  type SemanticDocument,
  type SemanticBlock,
  type DocumentDiffResult,
  type DiffOperation,
  type InlineChange,
} from '@worldwiki/ast-diff-wasm';
import wasmUrl from '../../../../../../packages/ast-diff-wasm/pkg/worldwiki_ast_diff_wasm_bg.wasm?url';

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

let wasmEngineInstance: WasmAstDiffEngine | null = null;
let wasmInitPromise: Promise<void> | null = null;
let isWasmInitialized = false;

export function isAstDiffWasmReady(): boolean {
  return isWasmInitialized && wasmEngineInstance !== null;
}

export async function ensureAstDiffWasm(): Promise<WasmAstDiffEngine> {
  if (wasmEngineInstance) return wasmEngineInstance;
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      try {
        await initWasm({ module_or_path: wasmUrl });
        wasmEngineInstance = new WasmAstDiffEngine();
        isWasmInitialized = true;
      } catch (err) {
        console.warn('[ast-diff.wasm-bridge] WASM initialization failed, using JS fallback:', err);
      }
    })();
  }
  await wasmInitPromise;
  return wasmEngineInstance!;
}

export function getAstDiffEngine(): WasmAstDiffEngine | null {
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
              dir ? path.resolve(dir, '../../../../../../packages/ast-diff-wasm/pkg/worldwiki_ast_diff_wasm_bg.wasm') : '',
              path.resolve(cwd, 'packages/ast-diff-wasm/pkg/worldwiki_ast_diff_wasm_bg.wasm'),
              path.resolve(cwd, '../../packages/ast-diff-wasm/pkg/worldwiki_ast_diff_wasm_bg.wasm'),
            ].filter(Boolean);
            for (const cand of candidates) {
              if (fs.existsSync(cand)) {
                const buffer = fs.readFileSync(cand);
                initSync({ module: buffer });
                wasmEngineInstance = new WasmAstDiffEngine();
                isWasmInitialized = true;
                return wasmEngineInstance;
              }
            }
          }
        } catch (err) {
          console.debug('[ast-diff.wasm-bridge] Node.js sync WASM fallback unavailable:', err);
        }
      }
      if (isWasmInitialized) {
        wasmEngineInstance = new WasmAstDiffEngine();
      } else {
        return null;
      }
    } catch (err) {
      console.debug('[ast-diff.wasm-bridge] WASM module not yet ready:', err);
      return null;
    }
  }
  return wasmEngineInstance;
}

/**
 * Вычисляет структурный Myers diff между двумя версиями SemanticDocument.
 */
export function computeSemanticDiff(
  oldDoc: SemanticDocument,
  newDoc: SemanticDocument
): DocumentDiffResult {
  const engine = getAstDiffEngine();
  if (engine) {
    try {
      return engine.compute_diff(oldDoc, newDoc) as DocumentDiffResult;
    } catch (err) {
      console.warn('[ast-diff.wasm-bridge] compute_diff error:', err);
    }
  }

  // JS Fallback: базовая разница
  const oldMap = new Map(oldDoc.blocks.map((b) => [b.id, b]));
  const newMap = new Map(newDoc.blocks.map((b) => [b.id, b]));
  const operations: DiffOperation[] = [];

  newDoc.blocks.forEach((block, index) => {
    if (!oldMap.has(block.id)) {
      operations.push({ InsertBlock: { index, block } });
    }
  });

  oldDoc.blocks.forEach((block, index) => {
    if (!newMap.has(block.id)) {
      operations.push({ DeleteBlock: { index, block_id: block.id } });
    }
  });

  return {
    operations,
    word_count_delta: 0,
    has_structural_changes: operations.length > 0,
  };
}

/**
 * Применяет патч DocumentDiffResult к исходному документу SemanticDocument.
 */
export function applySemanticPatch(
  oldDoc: SemanticDocument,
  patch: DocumentDiffResult
): SemanticDocument {
  const engine = getAstDiffEngine();
  if (engine) {
    try {
      return engine.apply_patch(oldDoc, patch) as SemanticDocument;
    } catch (err) {
      console.warn('[ast-diff.wasm-bridge] apply_patch error:', err);
    }
  }

  // Fallback: поверхностная копия
  return JSON.parse(JSON.stringify(oldDoc));
}

/**
 * Вычисляет посимвольный инлайн-дифф между двумя текстовыми строками.
 */
export function computeInlineDiff(oldText: string, newText: string): InlineChange[] {
  const engine = getAstDiffEngine();
  if (engine) {
    try {
      return engine.compute_inline_diff(oldText, newText) as InlineChange[];
    } catch (err) {
      console.warn('[ast-diff.wasm-bridge] compute_inline_diff error:', err);
    }
  }

  return [];
}

export type {
  SemanticDocument,
  SemanticBlock,
  DocumentDiffResult,
  DiffOperation,
  InlineChange,
};

