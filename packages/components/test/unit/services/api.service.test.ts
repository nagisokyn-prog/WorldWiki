// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stringifyId, processIds, invoke, uploadPhoto, getLocalFile } from '../../../src/ts/services/api.service';

describe('packages/components api.service', () => {
  describe('stringifyId', () => {
    it('handles null, undefined, and empty string', () => {
      expect(stringifyId(null)).toBe('');
      expect(stringifyId(undefined)).toBe('');
      expect(stringifyId('')).toBe('');
    });

    it('handles plain string IDs', () => {
      expect(stringifyId('characters:hero_1')).toBe('characters:hero_1');
      expect(stringifyId('{String:"chapters:ch_1"}')).toBe('chapters:ch_1');
    });

    it('handles standard SurrealDB RecordId object with tb and id', () => {
      expect(stringifyId({ tb: 'character', id: '123' })).toBe('character:123');
      expect(stringifyId({ tb: 'chapter', id: { String: 'ch_intro' } })).toBe('chapter:ch_intro');
      expect(stringifyId({ tb: 'item', id: { Int: 42 } })).toBe('item:42');
    });

    it('handles primitive numbers and booleans', () => {
      expect(stringifyId(12345)).toBe('12345');
      expect(stringifyId(true)).toBe('true');
    });

    it('handles object with String property', () => {
      expect(stringifyId({ String: 'locations:city_1' })).toBe('locations:city_1');
    });

    it('handles Uuid wrapper in nested tb/id object (line 69)', () => {
      expect(stringifyId({ tb: 'thing', id: { Uuid: '550e8400-e29b-41d4-a716-446655440000' } }))
        .toBe('thing:550e8400-e29b-41d4-a716-446655440000');
    });

    it('falls back to JSON.stringify for unknown inner id object (line 69)', () => {
      // Строка 71 убирает кавычки из результата, поэтому без "
      expect(stringifyId({ tb: 'item', id: { foo: 'bar', num: 1 } })).toBe('item:{foo:bar,num:1}');
      // compound object без String/Int/Uuid
      expect(stringifyId({ tb: 'item', id: { deep: { x: 'y' } } })).toBe('item:{deep:{x:y}}');
    });

    it('strips quotes, angle and corner brackets from inner ids (lines 71-76)', () => {
      expect(stringifyId({ tb: 'thing', id: { String: 'a"b' } })).toBe('thing:ab');
      expect(stringifyId({ String: 'a"b⟨c⟩d' })).toBe('abcd');
      expect(stringifyId({ tb: 'thing', id: { Int: 42 } })).toBe('thing:42');
    });
  });

  describe('processIds', () => {
    it('normalizes nested objects and arrays of IDs', () => {
      const input = {
        id: { tb: 'entity', id: 'e1' },
        title: 'Title',
        participants: [
          { tb: 'character', id: 'c1' },
          { tb: 'character', id: 'c2' },
        ],
        plainArray: [{ name: 'item1' }, { name: 'item2' }],
        nested: {
          refId: { String: 'ref_10' },
        },
      };

      const output = processIds(input);
      expect(output.id).toBe('entity:e1');
      expect(output.title).toBe('Title');
      expect(output.participants).toEqual(['character:c1', 'character:c2']);
      expect(output.plainArray).toEqual([{ name: 'item1' }, { name: 'item2' }]);
      expect(output.nested.refId).toBe('ref_10');
    });

    it('normalizes root array of items', () => {
      const arr = [1, 'string', { tb: 'test', id: '1' }];
      expect(processIds(arr)).toEqual([1, 'string', { tb: 'test', id: '1' }]);
    });

    it('returns primitive values as-is', () => {
      expect(processIds(null)).toBeNull();
      expect(processIds(123)).toBe(123);
      expect(processIds('string')).toBe('string');
    });
  });

  describe('invoke & system commands', () => {
    beforeEach(() => {
      (window as any).__TAURI__ = {
        core: {
          invoke: vi.fn().mockImplementation((cmd, _args) => {
            if (cmd === 'upload_photo') return Promise.resolve('/path/to/photo.jpg');
            if (cmd === 'get_local_file') return Promise.resolve([1, 2, 3]);
            return Promise.resolve(null);
          }),
        },
      };
    });

    afterEach(() => {
      delete (window as any).__TAURI__;
    });

    it('uploadPhoto invokes upload_photo with bytes and filename', async () => {
      const res = await uploadPhoto([10, 20, 30], 'avatar.png');
      expect(res).toBe('/path/to/photo.jpg');
      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledWith('upload_photo', {
        bytes: [10, 20, 30],
        filename: 'avatar.png',
      });
    });

    it('getLocalFile invokes get_local_file with path', async () => {
      const res = await getLocalFile('/path/to/file.txt');
      expect(res).toEqual([1, 2, 3]);
      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledWith('get_local_file', {
        path: '/path/to/file.txt',
      });
    });

    it('invoke delegates to tauri core invoke', async () => {
      await invoke('custom_cmd', { a: 1 });
      expect((window as any).__TAURI__.core.invoke).toHaveBeenCalledWith('custom_cmd', { a: 1 });
    });

    it('handles mock invoke fallback when imported without Tauri', async () => {
      vi.resetModules();
      delete (window as any).__TAURI__;

      const apiModule = await import('../../../src/ts/services/api.service');
      expect(apiModule.isTauri).toBe(false);

      expect(await apiModule.invoke('load_settings')).toBeNull();
      expect(await apiModule.invoke('save_settings')).toBeNull();
      expect(await apiModule.invoke('run_performance_benchmark')).toEqual(expect.objectContaining({ level: 'high' }));
      expect(await apiModule.invoke('get_performance_styles')).toBe('');
      expect(await apiModule.invoke('get_custom_themes')).toEqual([]);
      expect(await apiModule.invoke('load_theme')).toBeNull();
      expect(await apiModule.invoke('unknown_cmd')).toBeNull();
    });
  });
});
