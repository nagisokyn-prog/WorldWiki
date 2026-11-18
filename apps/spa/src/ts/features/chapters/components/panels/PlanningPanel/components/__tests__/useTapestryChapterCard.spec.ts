import { describe, it, expect, vi } from 'vitest';
import { useTapestryChapterCard } from '../TapestryChapterCard/useTapestryChapterCard';
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

  it('covers standalone todo add/cancel/submit, null arcId, and bound arc filtering', () => {
    const emit = vi.fn();
    const boundChapter: TapestryChapterNode = {
      ...chapter,
      arcGroups: [{ arcId: 'story_arcs:arc1', arcTitle: 'Арка 1', arcColor: null, todos: [] }],
    };
    const allArcs = [
      { id: 'story_arcs:arc1', title: 'Арка 1', color: null, arc_type: 'plot', status: 'active', project_id: 'p1' },
      { id: 'story_arcs:arc2', title: 'Арка 2', color: null, arc_type: 'plot', status: 'active', project_id: 'p1' },
    ];

    const hook = useTapestryChapterCard({ chapter: boundChapter, allProjectArcs: allArcs }, emit);
    expect(hook.availableArcs.value.map((a) => a.id)).toEqual(['story_arcs:arc2']);

    hook.isArcPickerOpen.value = true;
    hook.selectArcToAttach(null);
    expect(hook.isArcPickerOpen.value).toBe(false);
    expect(emit).not.toHaveBeenCalled();

    hook.startAddingStandalone();
    expect(hook.isAddingStandalone.value).toBe(true);
    hook.newStandaloneText.value = '   ';
    hook.submitStandalone();
    expect(emit).not.toHaveBeenCalled();
    expect(hook.isAddingStandalone.value).toBe(false);

    hook.startAddingStandalone();
    hook.newStandaloneText.value = 'Новая заметка';
    hook.submitStandalone();
    expect(emit).toHaveBeenCalledWith('add-todo', {
      ownerId: 'chapters:ch1',
      text: 'Новая заметка',
      arcId: null,
    });
    expect(hook.isAddingStandalone.value).toBe(false);

    hook.startAddingStandalone();
    hook.cancelStandalone();
    expect(hook.isAddingStandalone.value).toBe(false);
  });
});
