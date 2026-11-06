import { describe, it, expect } from 'vitest';
import { usePlanItemRow } from './usePlanItemRow';

describe('usePlanItemRow', () => {
  it('initializes correctly', () => {
    const hook = usePlanItemRow();
    expect(hook).toBeDefined();
  });
});
