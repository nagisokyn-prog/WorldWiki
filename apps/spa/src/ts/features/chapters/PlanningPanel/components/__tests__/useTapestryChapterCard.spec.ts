import { describe, it, expect, vi } from 'vitest';
import { useTapestryChapterCard } from '../useTapestryChapterCard';
import type { TapestryChapterNode } from '../../PlanningPanel.model';

describe('useTapestryChapterCard', () => {
  const chapter: TapestryChapterNode = {
    chapterId: 'chapters:ch1',
    title: 'Глава 1',
    sortOrder: 1,
    isCurrent: false,
    isCollapsed: true,
    arcGroups: [],
    standaloneTodos: [],
    doneCount: 0,
    totalCount: 0
  };

  it('filters available arcs and attaches arc', () => {
    const emit = vi.fn();
    const allArcs = [
      { id: 'story_arcs:arc1', title: 'Арка 1', color: null, arc_type: 'plot', status: 'active', project_id: 'p1' },
      { id: 'story_arcs:arc2', title: 'Арка 2', color: null, arc_type: 'plot', status: 'active', project_id: 'p1' }
    ];

    const hook = useTapestryChapterCard({ chapter, allProjectArcs: allArcs }, emit);

    expect(hook.availableArcs.value.length).toBe(2);

    hook.selectArcToAttach('story_arcs:arc1');
    expect(emit).toHaveBeenCalledWith('attach-arc', {
      chapterId: 'chapters:ch1',
      arcId: 'story_arcs:arc1'
    });

    hook.onToggleCollapse();
    expect(emit).toHaveBeenCalledWith('toggle-collapse', 'chapters:ch1');
  });
});
