import { describe, it, expect } from 'vitest';
import { useEntityHistoryAside } from './useEntityHistoryAside';

describe('useEntityHistoryAside', () => {
  it('returns an empty object', () => {
    expect(useEntityHistoryAside()).toEqual({});
  });
});

