/**
 * @file index.ts
 * @description Прямой фасад над WebAssembly-артефактами worldwiki-ast-diff-wasm.
 */

import initWasm, {
  initSync,
  WasmAstDiffEngine,
  type InitInput,
  type InitOutput,
  type SyncInitInput,
} from '../pkg/worldwiki_ast_diff_wasm.js';

export {
  initWasm,
  initWasm as initWasmAstDiffEngine,
  initSync,
  WasmAstDiffEngine,
  type InitInput,
  type InitOutput,
  type SyncInitInput,
};

export default initWasm;

export * from './types';

