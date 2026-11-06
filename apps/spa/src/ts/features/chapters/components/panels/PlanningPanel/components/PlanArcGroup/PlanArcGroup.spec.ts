import { describe, it, expect } from 'vitest';
import { usePlanArcGroup } from './usePlanArcGroup';

describe('usePlanArcGroup', () => {
  it('initializes correctly', () => {
    const hook = usePlanArcGroup();
    expect(hook).toBeDefined();
  });
});
