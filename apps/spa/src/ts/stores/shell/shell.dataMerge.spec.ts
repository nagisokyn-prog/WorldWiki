import { describe, it, expect } from 'vitest';
import { deepMergeData } from './shell.dataMerge';

describe('shell.dataMerge -> deepMergeData', () => {
  it('should handle merging into empty or uninitialized objects and arrays safely', () => {
    const target: Record<string, unknown> = {};
    const source = {
      name: 'Григорианский',
      eras: [
        {
          id: 'era_1',
          anchor_events: [
            { id: 'ev_1', name: 'Коронация' }
          ]
        }
      ]
    };

    deepMergeData(target, source);

    expect(target.name).toBe('Григорианский');
    expect(Array.isArray(target.eras)).toBe(true);
    expect((target.eras as any[])[0].anchor_events[0].name).toBe('Коронация');
  });

  it('should not throw if target array element is undefined when merging array of objects', () => {
    const target: Record<string, unknown> = {
      eras: [undefined]
    };
    const source = {
      eras: [
        {
          id: 'era_1',
          anchor_events: [{ id: 'ev_1' }]
        }
      ]
    };

    expect(() => deepMergeData(target, source)).not.toThrow();
    expect((target.eras as any[])[0].anchor_events[0].id).toBe('ev_1');
  });

  it('should handle null/undefined target or source gracefully', () => {
    expect(() => deepMergeData(null as any, {})).not.toThrow();
    expect(() => deepMergeData({}, null as any)).not.toThrow();
    expect(() => deepMergeData(undefined as any, undefined as any)).not.toThrow();
  });

  it('should truncate target array if source array is shorter', () => {
    const target: Record<string, unknown> = {
      items: [1, 2, 3, 4]
    };
    const source = {
      items: [10, 20]
    };

    deepMergeData(target, source);
    expect(target.items).toEqual([10, 20]);
  });
});

