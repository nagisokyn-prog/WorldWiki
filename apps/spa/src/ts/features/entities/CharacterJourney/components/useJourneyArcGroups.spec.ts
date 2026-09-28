import { describe, it, expect } from 'vitest';
import { useJourneyArcGroups } from './useJourneyArcGroups';
import type { ArcGroup } from '../CharacterJourney.model';

describe('useJourneyArcGroups Composable', () => {
  const sampleGroups: ArcGroup[] = [
    {
      arcId: 'arc:1',
      arcTitle: 'Арка 1',
      items: [
        { id: '1', type: 'promise', title: 'Сцена 1' },
        { id: '2', type: 'promise', title: 'Сцена 2' },
      ],
    },
    {
      arcId: 'arc:2',
      arcTitle: 'Арка 2',
      items: [
        { id: '3', type: 'promise', title: 'Сцена 3' },
      ],
    },
  ];

  it('calculates total scenes and toggles collapsed state for arc branches', () => {
    const { totalScenesCount, toggleArc, isArcCollapsed } = useJourneyArcGroups(() => sampleGroups);

    expect(totalScenesCount.value).toBe(3);
    expect(isArcCollapsed('arc:1')).toBe(false);

    toggleArc('arc:1');
    expect(isArcCollapsed('arc:1')).toBe(true);
    expect(isArcCollapsed('arc:2')).toBe(false);

    toggleArc('arc:1');
    expect(isArcCollapsed('arc:1')).toBe(false);
  });
});
