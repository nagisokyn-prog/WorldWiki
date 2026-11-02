import { type Ref } from 'vue';
import * as api from '@/services/api.client';
import { appAlert } from '@worldwiki/components';
import type {
  TapestryChapterNode,
  TapestryTodo,
  TodoStatus,
  PlanningPanelEmitFn
} from './PlanningPanel.model';
import {
  getCleanId,
  getQualifiedOwnerId,
  mapToTapestryTodo,
  NEXT_STATUS_MAP,
  CYCLE_STATUS_MAP,
  cascadeUnblockDependencies,
  insertTodoIntoState,
  removeTodoFromState
} from './planningPanel.utils';

export function usePlanningTodos(
  chaptersList: Ref<TapestryChapterNode[]>,
  backlogTodos: Ref<TapestryTodo[]>,
  resolvedVolumeId: Ref<string | null>,
  currentChapterId: Ref<string | null | undefined>,
  emit?: PlanningPanelEmitFn
) {
  async function toggleTodoStatus(todo: TapestryTodo) {
    const nextStatus = NEXT_STATUS_MAP[todo.status] || 'planned';
    await applyStatus(todo, nextStatus);
  }

  async function cycleStatus(todo: TapestryTodo) {
    const nextStatus = CYCLE_STATUS_MAP[todo.status] || 'planned';
    await applyStatus(todo, nextStatus);
  }

  async function applyStatus(todo: TapestryTodo, nextStatus: TodoStatus) {
    const oldStatus = todo.status;
    const oldDone = todo.done;
    todo.status = nextStatus;
    todo.done = nextStatus === 'done';

    try {
      await api.setTodoStatus(todo.id, nextStatus);

      if (nextStatus === 'done') {
        cascadeUnblockDependencies(chaptersList.value, todo.id);
      }

      emit?.('change');
    } catch (e) {
      todo.status = oldStatus;
      todo.done = oldDone;
      appAlert('Не удалось обновить статус задачи');
      console.error(e);
    }
  }

  async function saveTodo(todo: TapestryTodo) {
    const text = todo.text.trim();
    if (!text) return;
    try {
      await api.createTodo(
        todo.owner_id,
        text,
        todo.sort_order,
        todo.arc_id || null,
        todo.depends_on || null
      );
      emit?.('change');
    } catch (e) {
      appAlert('Ошибка при сохранении задачи');
      console.error(e);
    }
  }

  async function addTodo(payload: {
    ownerId: string;
    text: string;
    arcId?: string | null;
    dependsOn?: string | null;
  }) {
    const ownerId = getQualifiedOwnerId(
      payload.ownerId,
      payload.ownerId.includes('volumes:') ? 'volume' : 'chapter'
    );
    try {
      const createdId = await api.createTodo(
        ownerId,
        payload.text,
        Date.now(),
        payload.arcId || null,
        payload.dependsOn || null
      );

      const newTapestryTodo = mapToTapestryTodo({
        id: createdId,
        owner_id: ownerId,
        text: payload.text,
        sort_order: Date.now(),
        arc_id: payload.arcId || null,
        depends_on: payload.dependsOn || null,
        status: 'planned' as unknown as string,
        is_done: false,
        project_id: ''
      });

      insertTodoIntoState(
        chaptersList.value,
        backlogTodos.value,
        newTapestryTodo,
        ownerId,
        payload.arcId,
        resolvedVolumeId.value
      );
      emit?.('change');
    } catch (e) {
      appAlert('Не удалось добавить задачу');
      console.error(e);
    }
  }

  async function deleteTodo(todoOrId: TapestryTodo | string) {
    const id = typeof todoOrId === 'string' ? todoOrId : todoOrId.id;
    const isDone = typeof todoOrId === 'string' ? false : todoOrId.done;
    try {
      await api.deleteTodo(id);
      removeTodoFromState(chaptersList.value, backlogTodos.value, id, isDone);
      emit?.('change');
    } catch (e) {
      appAlert('Не удалось удалить задачу');
      console.error(e);
    }
  }

  async function moveBacklogToChapter(
    todoOrId: TapestryTodo | string,
    targetChapterId?: string
  ) {
    const target = targetChapterId || currentChapterId.value || chaptersList.value.find(c => c.isCurrent)?.chapterId;
    if (!target) return;

    const todo = typeof todoOrId === 'string'
      ? backlogTodos.value.find(t => getCleanId(t.id) === getCleanId(todoOrId))
      : todoOrId;
    if (!todo) return;

    const qualifiedTarget = getQualifiedOwnerId(target, 'chapter');
    try {
      await api.deleteTodo(todo.id);
      removeTodoFromState(chaptersList.value, backlogTodos.value, todo.id, todo.done);

      const createdId = await api.createTodo(
        qualifiedTarget,
        todo.text,
        Date.now(),
        todo.arc_id || null,
        todo.depends_on || null
      );

      const updatedTodo: TapestryTodo = {
        ...todo,
        id: createdId,
        owner_id: qualifiedTarget
      };

      insertTodoIntoState(
        chaptersList.value,
        backlogTodos.value,
        updatedTodo,
        qualifiedTarget,
        todo.arc_id,
        resolvedVolumeId.value
      );
      emit?.('change');
    } catch (e) {
      appAlert('Не удалось перенести задачу в главу');
      console.error(e);
    }
  }

  return {
    toggleTodoStatus,
    cycleStatus,
    saveTodo,
    addTodo,
    deleteTodo,
    moveBacklogToChapter
  };
}
