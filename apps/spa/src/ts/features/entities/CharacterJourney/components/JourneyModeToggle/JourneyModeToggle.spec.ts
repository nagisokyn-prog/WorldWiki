import { describe, it, expect } from 'vitest';
import { useJourneyModeToggle } from './useJourneyModeToggle';

describe('useJourneyModeToggle', () => {
  it('initializes correctly', () => {
    const hook = useJourneyModeToggle();
    expect(hook).toBeDefined();
  });
});
