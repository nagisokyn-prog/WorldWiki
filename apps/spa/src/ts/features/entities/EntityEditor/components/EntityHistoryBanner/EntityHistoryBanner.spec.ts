import { describe, it, expect } from 'vitest';
import { useEntityHistoryBanner } from './useEntityHistoryBanner';

describe('useEntityHistoryBanner', () => {
  it('initializes correctly', () => {
    const hook = useEntityHistoryBanner();
    expect(hook).toBeDefined();
  });
});
