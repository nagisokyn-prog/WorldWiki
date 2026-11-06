import { describe, it, expect } from 'vitest';
import { useJourneyToolbar } from './useJourneyToolbar';

describe('useJourneyToolbar', () => {
  it('initializes correctly', () => {
    const hook = useJourneyToolbar();
    expect(hook).toBeDefined();
  });
});
