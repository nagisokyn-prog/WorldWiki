import { describe, it, expect } from 'vitest';
import { useMatrixToolbar } from './useMatrixToolbar';

describe('useMatrixToolbar', () => {
  it('initializes correctly', () => {
    const hook = useMatrixToolbar();
    expect(hook).toBeDefined();
  });
});
