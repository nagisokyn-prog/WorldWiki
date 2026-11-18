import { describe, it, expect } from 'vitest';
import {
  computeSemanticDiff,
  applySemanticPatch,
  computeInlineDiff,
  ensureAstDiffWasm,
  type SemanticDocument,
} from './ast-diff.wasm-bridge';

describe('ast-diff.wasm-bridge', () => {
  const docA: SemanticDocument = {
    version: 1,
    blocks: [
      { id: 'b1', block_type: 'paragraph', content: 'Привет мир' },
      { id: 'b2', block_type: 'paragraph', content: 'Вторая строка' },
    ],
  };

  const docB: SemanticDocument = {
    version: 2,
    blocks: [
      { id: 'b1', block_type: 'paragraph', content: 'Привет мир!' },
      { id: 'b3', block_type: 'paragraph', content: 'Новый блок' },
    ],
  };

  it('computes semantic diff and applies patch accurately', async () => {
    await ensureAstDiffWasm();

    const diff = computeSemanticDiff(docA, docB);
    expect(diff.operations.length).toBeGreaterThan(0);

    const patched = applySemanticPatch(docA, diff);
    expect(patched.blocks.length).toBe(2);
    expect(patched.blocks.find((b) => b.id === 'b3')?.content).toBe('Новый блок');
  });

  it('computes character-level inline diff between text strings', async () => {
    await ensureAstDiffWasm();

    const changes = computeInlineDiff('Артур пошел в замок', 'Артур быстро пошел в замок');
    expect(changes.length).toBeGreaterThan(0);
    const inserted = changes.find((c) => c.insert_text.includes('быстро'));
    expect(inserted).toBeDefined();
  });

  it('covers getAstDiffEngine and JS fallback on WASM errors', async () => {
    const { vi } = await import('vitest');
    const { getAstDiffEngine } = await import('./ast-diff.wasm-bridge');
    await ensureAstDiffWasm();

    const engine = getAstDiffEngine();
    expect(engine).not.toBeNull();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const diffSpy = vi.spyOn(engine!, 'compute_diff').mockImplementationOnce(() => {
      throw new Error('wasm diff err');
    });
    const patchSpy = vi.spyOn(engine!, 'apply_patch').mockImplementationOnce(() => {
      throw new Error('wasm patch err');
    });
    const inlineSpy = vi.spyOn(engine!, 'compute_inline_diff').mockImplementationOnce(() => {
      throw new Error('wasm inline err');
    });

    const fbDiff = computeSemanticDiff(docA, docB);
    expect(fbDiff.has_structural_changes).toBe(true);

    const fbPatched = applySemanticPatch(docA, fbDiff);
    expect(fbPatched.blocks).toHaveLength(2);

    const fbInline = computeInlineDiff('a', 'b');
    expect(fbInline).toEqual([]);

    diffSpy.mockRestore();
    patchSpy.mockRestore();
    inlineSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

