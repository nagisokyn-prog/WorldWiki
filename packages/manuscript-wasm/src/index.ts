/**
 * @file index.ts
 * @description Прямой фасад над WebAssembly-артефактами worldwiki-manuscript-wasm.
 */

import initWasm, {
  initSync,
  WasmManuscriptEngine,
  type InitInput,
  type InitOutput,
  type SyncInitInput,
} from '../pkg/worldwiki_manuscript_wasm.js';

export {
  initWasm,
  initWasm as initWasmManuscriptEngine,
  initSync,
  WasmManuscriptEngine,
  type InitInput,
  type InitOutput,
  type SyncInitInput,
};

export default initWasm;

export * from './types';

