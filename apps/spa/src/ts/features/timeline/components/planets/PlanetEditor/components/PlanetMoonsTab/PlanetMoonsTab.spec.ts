import { describe, it, expect } from 'vitest';
import { usePlanetMoonsTab } from './usePlanetMoonsTab';

describe('usePlanetMoonsTab', () => {
  it('initializes correctly', () => {
    const hook = usePlanetMoonsTab();
    expect(hook).toBeDefined();
  });
});
