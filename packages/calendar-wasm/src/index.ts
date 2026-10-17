/**
 * @file index.ts
 * @description Прямой фасад над WebAssembly-артефактами worldwiki-calendar-wasm.
 */

import initWasm, {
  initSync,
  WasmCalendarEngine,
  type InitInput,
  type InitOutput,
  type SyncInitInput,
} from '../pkg/worldwiki_calendar_wasm.js';

export {
  initWasm,
  initWasm as initWasmCalendarEngine,
  initSync,
  WasmCalendarEngine,
  type InitInput,
  type InitOutput,
  type SyncInitInput,
};

export default initWasm;

export * from './types';
