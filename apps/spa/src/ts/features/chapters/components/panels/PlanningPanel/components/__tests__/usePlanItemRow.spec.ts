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

  it('groups available candidates and emits set-dependency', () => {
    const emit = vi.fn();
    const hook = usePlanItemRow(
      {
        item: { ...baseTodo, id: 't1' },
        allTodos: [
          { id: 't1', text: 'Тест сам себя', chapterId: 'ch1', chapterTitle: 'Гл 1', status: 'planned' },
          { id: 't2', text: 'Родительская задача', chapterId: 'ch2', chapterTitle: 'Гл 2', status: 'planned' }
        ]
      },
      emit
    );

    expect(hook.groupedCandidates.value.length).toBe(1);
    expect(hook.groupedCandidates.value[0].todos[0].id).toBe('t2');

    expect(hook.isDepMenuOpen.value).toBe(false);
    hook.toggleDepMenu();
    expect(hook.isDepMenuOpen.value).toBe(true);

    hook.onSelectDependency('t2');
    expect(emit).toHaveBeenCalledWith('set-dependency', expect.anything(), 't2');
    expect(hook.isDepMenuOpen.value).toBe(false);

    hook.onSelectDependency(null);
    expect(emit).toHaveBeenCalledWith('set-dependency', expect.anything(), null);
  });

  it('opens and closes status menu and emits set-status when selecting specific status', () => {
    const emit = vi.fn();
    const hook = usePlanItemRow(
      { item: { ...baseTodo, status: 'planned' } },
      emit
    );

    expect(hook.isStatusMenuOpen.value).toBe(false);
    hook.openStatusMenu();
    expect(hook.isStatusMenuOpen.value).toBe(true);

    hook.onSelectStatus('in_progress');
    expect(emit).toHaveBeenCalledWith('set-status', expect.anything(), 'in_progress');
    expect(hook.isStatusMenuOpen.value).toBe(false);
  });
});
