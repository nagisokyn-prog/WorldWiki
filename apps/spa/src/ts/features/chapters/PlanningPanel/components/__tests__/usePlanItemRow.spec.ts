import { describe, it, expect, vi } from 'vitest';
import { usePlanItemRow } from '../usePlanItemRow';
import type { TapestryTodo } from '../../PlanningPanel.model';

describe('usePlanItemRow', () => {
  const baseTodo: TapestryTodo = {
    id: 't1',
    owner_id: 'ch1',
    text: 'Тест',
    status: 'planned',
    done: false,
    sort_order: 1,
    arc_id: null,
    arc_title: null,
    arc_color: null,
    depends_on: null,
    depends_on_title: null,
    blocks_title: null,
    blocks_chapter_id: null
  };

  it('provides correct tooltips for all statuses and emits events', () => {
    const emit = vi.fn();
    const { statusTooltip, onToggle, onCycleStatus, onSave, onDelete, onNavigate } = usePlanItemRow(
      { item: { ...baseTodo, status: 'planned' } },
      emit
    );

    expect(statusTooltip.value).toContain('В планах');

    onToggle();
    expect(emit).toHaveBeenCalledWith('toggle', expect.anything());

    onCycleStatus();
    expect(emit).toHaveBeenCalledWith('cycle-status', expect.anything());

    onSave();
    expect(emit).toHaveBeenCalledWith('save', expect.anything());

    onDelete();
    expect(emit).toHaveBeenCalledWith('delete', expect.anything());

    onNavigate('ch2');
    expect(emit).toHaveBeenCalledWith('navigate', 'ch2');
  });

  it('renders tooltips for in_progress, done and blocked', () => {
    const emit = vi.fn();
    const inProg = usePlanItemRow({ item: { ...baseTodo, status: 'in_progress' } }, emit);
    expect(inProg.statusTooltip.value).toContain('В работе');

    const done = usePlanItemRow({ item: { ...baseTodo, status: 'done' } }, emit);
    expect(done.statusTooltip.value).toContain('Готово');

    const blocked = usePlanItemRow({ item: { ...baseTodo, status: 'blocked' } }, emit);
    expect(blocked.statusTooltip.value).toContain('Ожидает');
  });
});
