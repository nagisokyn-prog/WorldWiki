import { describe, it, expect } from 'vitest';
import { useChaptersHistoryDrawer } from './useChaptersHistoryDrawer';

describe('useChaptersHistoryDrawer', () => {
  it('initializes correctly', () => {
    const hook = useChaptersHistoryDrawer();
    expect(hook).toBeDefined();
  });
});
