import { describe, it, expect } from 'vitest';
import { useChekhovTrackerToolbar } from './useChekhovTrackerToolbar';

describe('useChekhovTrackerToolbar', () => {
  it('initializes correctly', () => {
    const hook = useChekhovTrackerToolbar();
    expect(hook).toBeDefined();
  });
});
