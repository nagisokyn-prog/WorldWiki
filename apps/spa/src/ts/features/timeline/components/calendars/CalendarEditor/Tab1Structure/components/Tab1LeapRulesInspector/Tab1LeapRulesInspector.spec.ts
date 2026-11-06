import { describe, it, expect } from 'vitest';
import { useTab1LeapRulesInspector } from './useTab1LeapRulesInspector';

describe('useTab1LeapRulesInspector', () => {
  it('initializes correctly', () => {
    const hook = useTab1LeapRulesInspector();
    expect(hook).toBeDefined();
  });
});
