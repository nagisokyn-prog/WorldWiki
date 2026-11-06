import { describe, it, expect } from 'vitest';
import { useMatrixLegend } from './useMatrixLegend';

describe('useMatrixLegend', () => {
  it('initializes correctly', () => {
    const hook = useMatrixLegend();
    expect(hook).toBeDefined();
  });
});
