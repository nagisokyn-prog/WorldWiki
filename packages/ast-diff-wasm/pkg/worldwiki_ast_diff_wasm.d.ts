/* tslint:disable */
/* eslint-disable */

export class WasmAstDiffEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Applies a DocumentDiffResult patch to a SemanticDocument
     */
    apply_patch(old_doc_json: any, patch_json: any): any;
    /**
     * Computes structural and inline diff between two versions of SemanticDocument
     */
    compute_diff(old_doc_json: any, new_doc_json: any): any;
    /**
     * Computes character-level inline diff between two text strings
     */
    compute_inline_diff(old_text: string, new_text: string): any;
    constructor();
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmastdiffengine_free: (a: number, b: number) => void;
    readonly wasmastdiffengine_apply_patch: (a: number, b: any, c: any) => [number, number, number];
    readonly wasmastdiffengine_compute_diff: (a: number, b: any, c: any) => [number, number, number];
    readonly wasmastdiffengine_compute_inline_diff: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly wasmastdiffengine_new: () => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
