import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { usePlanningTodos } from '../usePlanningTodos';
import * as api from '@/services/api.client';
import type { TapestryChapterNode, TapestryTodo } from '../PlanningPanel.model';

vi.mock('@/services/api.client', () => ({
  createTodo: vi.fn().mockResolvedValue('todo:new_1'),
  setTodoStatus: vi.fn().mockResolvedValue({ id: 'todo:1', status: 'done' }),
  deleteTodo: vi.fn().mockResolvedValue(true)
}));

vi.mock('@worldwiki/components', () => ({
  appAlert: vi.fn()
}));

describe('usePlanningTodos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cycles and updates todo status', async () => {
    const chaptersList = ref<TapestryChapterNode[]>([]);
    const backlog = ref<TapestryTodo[]>([]);
    const volId = ref<string | null>('volumes:v1');
    const curChId = ref<string | null>('chapters:c1');
    const emit = vi.fn();

    const { cycleStatus } = usePlanningTodos(chaptersList, backlog, volId, curChId, emit as any);
    const todo: TapestryTodo = {
      id: 'todo:1',
      owner_id: 'chapters:ch1',
      text: 'Test task',
      status: 'planned',
      done: false,
      sort_order: 1
    };

    await cycleStatus(todo);

    expect(todo.status).toBe('in_progress');
    expect(api.setTodoStatus).toHaveBeenCalledWith('todo:1', 'in_progress');
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('adds todo and adds it to state', async () => {
    const chaptersList = ref<TapestryChapterNode[]>([
      {
        chapterId: 'chapters:ch1',
        title: 'Ch 1',
        sortOrder: 1,
        isCurrent: true,
        isCollapsed: false,
        arcGroups: [],
        standaloneTodos: [],
        doneCount: 0,
        totalCount: 0
      }
    ]);
    const backlog = ref<TapestryTodo[]>([]);
    const volId = ref<string | null>('volumes:v1');
    const curChId = ref<string | null>('chapters:c1');
    const emit = vi.fn();

    const { addTodo } = usePlanningTodos(chaptersList, backlog, volId, curChId, emit as any);
    await addTodo({
      ownerId: 'chapters:ch1',
      text: 'New chapter task'
    });

    expect(api.createTodo).toHaveBeenCalled();
    expect(chaptersList.value[0].standaloneTodos.length).toBe(1);
    expect(chaptersList.value[0].standaloneTodos[0].text).toBe('New chapter task');
    expect(emit).toHaveBeenCalledWith('change');
  });

  it('deletes todo and removes it from state', async () => {
    const chaptersList = ref<TapestryChapterNode[]>([]);
    const backlog = ref<TapestryTodo[]>([
      {
        id: 'todo:del',
        owner_id: 'volumes:vol1',
        text: 'Backlog item',
        status: 'planned',
        done: false,
        sort_order: 1
      }
    ]);
    const volId = ref<string | null>('volumes:vol1');
    const curChId = ref<string | null>(null);
    const emit = vi.fn();

    const { deleteTodo } = usePlanningTodos(chaptersList, backlog, volId, curChId, emit as any);
    await deleteTodo('todo:del');

    expect(api.deleteTodo).toHaveBeenCalledWith('todo:del');
    expect(backlog.value.length).toBe(0);
    expect(emit).toHaveBeenCalledWith('change');
  });
});
