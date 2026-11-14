import { describe, it, expect } from 'vitest';
import { deepMergeRecord } from './EntityEditorWindow.utils';

describe('EntityEditorWindow.utils', () => {
  describe('deepMergeRecord', () => {
    it('merges nested objects and primitive values in place', () => {
      const target: Record<string, unknown> = {
        name: 'Старое',
        meta: { level: 1, keep: true },
        overwriteMe: 'scalar'
      };

      deepMergeRecord(target, {
        name: 'Новое',
        meta: { level: 2, added: 'yes' },
        overwriteMe: { nested: 42 },
        nullable: null
      });

      expect(target).toEqual({
        name: 'Новое',
        meta: { level: 2, keep: true, added: 'yes' },
        overwriteMe: { nested: 42 },
        nullable: null
      });
    });

    it('merges arrays of objects and primitives and truncates or extends lengths', () => {
      const target: Record<string, unknown> = {
        items: [
          { id: 1, title: 'A', extra: 'keep' },
          { id: 2, title: 'B' },
          { id: 3, title: 'Remove' }
        ],
        tags: ['old1', 'old2', 'old3'],
        notArray: 'was-string'
      };

      deepMergeRecord(target, {
        items: [
          { id: 1, title: 'A2' },
          { id: 2, title: 'B2' }
        ],
        tags: ['new1', 'new2', 'new3', 'new4'],
        notArray: [10, 20]
      });

      expect(target).toEqual({
        items: [
          { id: 1, title: 'A2', extra: 'keep' },
          { id: 2, title: 'B2' }
        ],
        tags: ['new1', 'new2', 'new3', 'new4'],
        notArray: [10, 20]
      });
    });
  });
});

