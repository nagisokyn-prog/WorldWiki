import { describe, it, expect } from 'vitest';
import { useJourneyTimelineList } from './useJourneyTimelineList';

describe('useJourneyTimelineList', () => {
  it('initializes correctly', () => {
    const hook = useJourneyTimelineList();
    expect(hook).toBeDefined();
  });
});
