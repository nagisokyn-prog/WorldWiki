import { describe, it, expect } from 'vitest';
import { usePromiseFilterBar } from './usePromiseFilterBar';

describe('usePromiseFilterBar', () => {
  it('initializes correctly', () => {
    const hook = usePromiseFilterBar();
    expect(hook).toBeDefined();
  });
});
