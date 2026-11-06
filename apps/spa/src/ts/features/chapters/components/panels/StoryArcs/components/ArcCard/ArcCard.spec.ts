import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useArcCard } from './useArcCard';
import type { ArcCardProps } from './ArcCard.model';

describe('useArcCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes correctly', () => {
    const props = {
      arc: { id: 'arc1', name: 'Arc 1' },
      linkedBlocks: [],
    } as unknown as ArcCardProps;
    const hook = useArcCard(props);
    expect(hook).toBeDefined();
    expect(hook.phaseCounts.value).toEqual({
      setup: 0,
      escalation: 0,
      climax: 0,
      resolution: 0,
    });
  });
});

