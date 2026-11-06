import { describe, it, expect, vi } from 'vitest';
import { usePlanArcGroup } from '../PlanArcGroup/usePlanArcGroup';
import type { TapestryArcGroup } from '../../PlanningPanel.model';

describe('usePlanArcGroup', () => {
  const arcGroup: TapestryArcGroup = {
    arcId: 'arc1',
    title: 'Арка 1',
    color: null,
    phase: 'setup',
    phaseLabel: '🌱 Завязка',
    todos: [
      { id: '1', owner_id: 'ch1', text: 'Task 1', status: 'done', done: true, sort_order: 1, arc_id: 'arc1', arc_title: null, arc_color: null, depends_on: null, depends_on_title: null, blocks_title: null, blocks_chapter_id: null },
      { id: '2', owner_id: 'ch1', text: 'Task 2', status: 'planned', done: false, sort_order: 2, arc_id: 'arc1', arc_title: null, arc_color: null, depends_on: null, depends_on_title: null, blocks_title: null, blocks_chapter_id: null }
    ]
  };

  it('calculates doneCount and manages adding todo', () => {
    const emit = vi.fn();
    const hook = usePlanArcGroup({ arcGroup, chapterId: 'ch1' }, emit);

    expect(hook.doneCount.value).toBe(1);

    hook.startAdding();
    expect(hook.isAdding.value).toBe(true);

    hook.newTodoText.value = 'Новая мысль';
    hook.submitAdd();

    expect(emit).toHaveBeenCalledWith('add-todo', {
      ownerId: 'ch1',
      text: 'Новая мысль',
      arcId: 'arc1'
    });
    expect(hook.isAdding.value).toBe(false);
  });
});
