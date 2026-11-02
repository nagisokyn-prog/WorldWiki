import { type Ref } from 'vue';
import * as api from '@/services/api.client';
import { appAlert, appConfirm } from '@worldwiki/components';
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
  removeTodoFromState,
  linkCrossChapterCausality
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
        const unblocked = cascadeUnblockDependencies(chaptersList.value, todo.id);
        if (unblocked.length === 1) {
          const target = unblocked[0];
          const confirmTake = await appConfirm(
            `🔓 Разблокирована следующая сцена:\n"${target.text}"\n\nВзять её в работу прямо сейчас?`
          );
          if (confirmTake) {
            await applyStatus(target, 'in_progress');
          }
        } else if (unblocked.length > 1) {
          const list = unblocked.map(t => `• ${t.text}`).join('\n');
          const confirmTake = await appConfirm(
            `🔓 Разблокированы сцены (${unblocked.length} шт.):\n${list}\n\nВзять их в работу прямо сейчас?`
          );
          if (confirmTake) {
            for (const t of unblocked) {
              await applyStatus(t, 'in_progress');
            }
          }
        }
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

  async function setDependency(todo: TapestryTodo, parentId: string | null) {
    const oldDep = todo.depends_on;
    const oldStatus = todo.status;
    const oldDone = todo.done;

    todo.depends_on = parentId;
    if (parentId) {
      let isParentDone = false;
      for (const ch of chaptersList.value) {
        for (const grp of ch.arcGroups) {
          const p = grp.todos.find(t => getCleanId(t.id) === getCleanId(parentId));
          if (p && (p.status === 'done' || p.done)) isParentDone = true;
        }
        const p = ch.standaloneTodos.find(t => getCleanId(t.id) === getCleanId(parentId));
        if (p && (p.status === 'done' || p.done)) isParentDone = true;
      }
      if (!isParentDone) {
        todo.status = 'blocked';
        todo.done = false;
      }
    } else if (todo.status === 'blocked') {
      todo.status = 'planned';
    }

    try {
      await api.setTodoDependency(todo.id, parentId);
      linkCrossChapterCausality(chaptersList.value);
      emit?.('change');
    } catch (e) {
      todo.depends_on = oldDep;
      todo.status = oldStatus;
      todo.done = oldDone;
      linkCrossChapterCausality(chaptersList.value);
      appAlert('Не удалось обновить зависимость задачи');
      console.error(e);
    }
  }

  async function addTodo(payload: {
    ownerId: string;
    text: string;
    arcId?: string | null;
    dependsOn?: string | null;
    ownerType?: 'volume' | 'chapter';
  }) {
    const cleanPayloadOwner = getCleanId(payload.ownerId);
    const cleanVolume = resolvedVolumeId.value ? getCleanId(resolvedVolumeId.value) : null;
    const isVolume =
      payload.ownerType === 'volume' ||
      payload.ownerId.startsWith('volumes:') ||
      Boolean(cleanVolume && cleanPayloadOwner === cleanVolume);

    const ownerId = getQualifiedOwnerId(
      payload.ownerId,
      isVolume ? 'volume' : 'chapter'
    );
    try {
      const nextOrder = Math.floor(Date.now() / 1000);
      const createdId = await api.createTodo(
        ownerId,
        payload.text,
        nextOrder,
        payload.arcId || null,
        payload.dependsOn || null
      );

      const newTapestryTodo = mapToTapestryTodo({
        id: createdId,
        owner_id: ownerId,
        text: payload.text,
        sort_order: nextOrder,
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

  async function addBacklog(payload: { ownerId?: string; text: string }) {
    const targetVolumeId =
      payload.ownerId ||
      resolvedVolumeId.value ||
      '';
    if (!targetVolumeId) {
      appAlert('Не выбран том для сохранения мысли в бэклог');
      return;
    }
    await addTodo({
      ownerId: targetVolumeId,
      text: payload.text,
      ownerType: 'volume'
    });
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
    todoOrIdOrPayload: TapestryTodo | string | { todoId: string; targetChapterId?: string },
    targetChapterIdParam?: string
  ) {
    let todoId: string;
    let targetChId = targetChapterIdParam;

    if (typeof todoOrIdOrPayload === 'object' && todoOrIdOrPayload !== null) {
      if ('todoId' in todoOrIdOrPayload) {
        todoId = todoOrIdOrPayload.todoId;
        targetChId = todoOrIdOrPayload.targetChapterId || targetChId;
      } else {
        todoId = (todoOrIdOrPayload as TapestryTodo).id;
      }
    } else {
      todoId = String(todoOrIdOrPayload);
    }

    const target = targetChId || currentChapterId.value || chaptersList.value.find(c => c.isCurrent)?.chapterId;
    if (!target) {
      appAlert('Не выбрана глава для переноса задачи');
      return;
    }

    const todo = backlogTodos.value.find(t => getCleanId(t.id) === getCleanId(todoId));
    if (!todo) return;

    const qualifiedTarget = getQualifiedOwnerId(target, 'chapter');
    try {
      await api.deleteTodo(todo.id);
      removeTodoFromState(chaptersList.value, backlogTodos.value, todo.id, todo.done);

      const nextOrder = Math.floor(Date.now() / 1000);
      const createdId = await api.createTodo(
        qualifiedTarget,
        todo.text,
        nextOrder,
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
    setDependency,
    addTodo,
    addBacklog,
    deleteTodo,
    moveBacklogToChapter
  };
}
