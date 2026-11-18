import { describe, it, expect } from 'vitest';
import {
  extractEntityMentions,
  resolveCrossReferences,
  ensureManuscriptWasm,
} from './manuscript.wasm-bridge';

describe('manuscript.wasm-bridge', () => {
  it('extracts entity mentions from manuscript text with ((...))', async () => {
    await ensureManuscriptWasm();
    const text = 'В замок прибыл ((Артур)) и встретил ((Мерлин|Старый маг)).';
    const mentions = extractEntityMentions(text);

    expect(mentions.length).toBe(2);
    expect(mentions[0].name).toBe('Артур');
    expect(mentions[1].name).toBe('Мерлин|Старый маг');
    expect(mentions[0].char_start).toBe(15);
  });

  it('handles text without entity mentions gracefully', async () => {
    await ensureManuscriptWasm();
    const text = 'Обычный текст без каких-либо скобок и сущностей.';
    const mentions = extractEntityMentions(text);
    expect(mentions).toEqual([]);
  });

  it('resolves cross references against entity index', async () => {
    await ensureManuscriptWasm();
    const refs = [
      { id: 'ref_1', target_id: 'ent_arthur', ref_type: 'character' },
      { id: 'ref_2', target_id: 'ent_unknown', ref_type: 'location' },
    ];
    const index = {
      ent_arthur: { title: 'Король Артур', path: 'characters/arthur' },
    };

    const resolved = resolveCrossReferences(refs, index);
    expect(resolved.length).toBe(2);
    expect(resolved[0].is_resolved).toBe(true);
    expect(resolved[0].target_title).toBe('Король Артур');
    expect(resolved[1].is_resolved).toBe(false);
  });

  it('covers detectActiveEntityQuery, isManuscriptWasmReady, and JS fallbacks on WASM error', async () => {
    const { vi } = await import('vitest');
    const {
      getManuscriptEngine,
      isManuscriptWasmReady,
      detectActiveEntityQuery,
    } = await import('./manuscript.wasm-bridge');

    await ensureManuscriptWasm();
    const engine = getManuscriptEngine();
    expect(engine).not.toBeNull();
    expect(isManuscriptWasmReady()).toBe(true);

    expect(detectActiveEntityQuery('')).toBeNull();
    expect(detectActiveEntityQuery('Привет ((Артур))')).toEqual({ query: 'Артур', length: 9, isClosed: true });
    expect(detectActiveEntityQuery('Привет ((Мер')).toEqual({ query: 'Мер', length: 5, isClosed: false });
    expect(detectActiveEntityQuery('Привет мир')).toBeNull();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const extSpy = vi.spyOn(engine!, 'extract_entities').mockImplementationOnce(() => {
      throw new Error('extract err');
    });
    const resSpy = vi.spyOn(engine!, 'resolve_cross_references').mockImplementationOnce(() => {
      throw new Error('resolve err');
    });

    const fbMentions = extractEntityMentions('((Герой)) и ((Маг))');
    expect(fbMentions).toHaveLength(2);

    const fbResolved = resolveCrossReferences(
      [{ id: 'r1', target_id: 'e1', ref_type: 'character' }],
      { e1: { title: 'Герой' } }
    );
    expect(fbResolved[0].is_resolved).toBe(true);

    extSpy.mockRestore();
    resSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('covers getBuiltinModule fallback and initWasm failure fallback in fresh module', async () => {
    const { vi } = await import('vitest');
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const mod = await import('./manuscript.wasm-bridge');
    expect(mod.isManuscriptWasmReady()).toBe(false);
    // Test JS fallback when WASM is not initialized and process is temporarily stubbed
    const origProcess = globalThis.process;
    vi.stubGlobal('process', undefined);
    expect(mod.getManuscriptEngine()).toBeNull();
    const mentions = mod.extractEntityMentions('((Алиса)) и ((Боб|Маг))');
    expect(mentions).toHaveLength(2);
    const resolved = mod.resolveCrossReferences(
      [{ id: 'r1', target_id: 'e1', ref_type: 'char' }, { id: 'r2', target_id: 'e2', ref_type: 'loc' }],
      { e1: { title: 'Алиса' } }
    );
    expect(resolved[0].is_resolved).toBe(true);
    expect(resolved[1].is_resolved).toBe(false);
    vi.stubGlobal('process', origProcess);

    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });
});

