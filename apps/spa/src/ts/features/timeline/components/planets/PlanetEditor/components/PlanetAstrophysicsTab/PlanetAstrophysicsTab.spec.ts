import { describe, it, expect } from 'vitest';
import { usePlanetAstrophysicsTab } from './usePlanetAstrophysicsTab';

describe('usePlanetAstrophysicsTab', () => {
  it('initializes correctly', () => {
    const hook = usePlanetAstrophysicsTab();
    expect(hook).toBeDefined();
  });
});
