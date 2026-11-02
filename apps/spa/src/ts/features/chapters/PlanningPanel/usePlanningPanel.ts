import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { appAlert } from '@worldwiki/components';
import * as api from '@/services/api.client';
import type { PlanItem, PlanningPanelProps, TodoStatus } from './PlanningPanel.model';

export type { PlanItem, PlanningPanelProps, TodoStatus };

export function usePlanningPanel(props: PlanningPanelProps) {
  const items = ref<PlanItem[]>([]);
  const listEl = ref<HTMLElement | null>(null);
  const saving = ref(false);
  const activeArcFilter = ref<string | null>(props.selectedArcFilter ?? null);

  watch(() => props.selectedArcFilter, (newVal) => {
    activeArcFilter.value = newVal ?? null;
  });

  // ─── Computed ────────────────────────────────────────────
  const nodeIcon = computed(() => {
    if (props.parentType === 'volume') return '📚';
    if (props.parentType === 'arc' || props.parentType === 'story_arc') return '🌀';
    return '📖';
  });

  const nodeName = computed(() => props.parentTitle || 'Без названия');

  const doneCount = computed(() => items.value.filter(i => i.status === 'done' || i.done).length);
  const inProgressCount = computed(() => items.value.filter(i => i.status === 'in_progress').length);
  const progressPct = computed(() =>
    items.value.length ? Math.round((doneCount.value / items.value.length) * 100) : 0
  );

  function getQualifiedOwnerId(): string {
    const raw = (props.parentId || '').trim();
    if (!raw) return '';
    if (raw.includes(':')) return raw;
    if (props.parentType === 'volume') return `volumes:${raw}`;
    if (props.parentType === 'arc' || props.parentType === 'story_arc') return `story_arcs:${raw}`;
    return `chapters:${raw}`;
  }

  // ─── Load ────────────────────────────────────────────────
  const load = async () => {
    const ownerId = getQualifiedOwnerId();
    if (!ownerId) {
      items.value = [];
      return;
    }
    try {
      const todos = await api.getTodos(ownerId);
      items.value = (todos || [])
        .map(t => {
          const rawStatus = (t.status as TodoStatus) || (t.is_done ? 'done' : 'planned');
          return {
            id: t.id || '',
            text: t.text || '',
            done: rawStatus === 'done',
            status: rawStatus,
            sort_order: t.sort_order != null ? Number(t.sort_order) : undefined,
            indent: 0,
            arc_id: t.arc_id || null,
            arc_title: t.arc_title || null,
            depends_on: t.depends_on || null,
          };
        })
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    } catch (e) {
      console.error('Ошибка загрузки задач:', e);
      items.value = [];
    }
  };

  onMounted(() => {
    void load();
  });

  watch(
    () => [props.project, props.parentType, props.parentId],
    () => {
      void load();
    },
    { immediate: true }
  );

  // ─── Save ────────────────────────────────────────────────
  const saveItem = async (item: PlanItem) => {
    if (!item.text.trim() && !item.id) return;
    const ownerId = getQualifiedOwnerId();
    if (!ownerId) return;
    try {
      if (!item.id) {
        const createdId = await api.createTodo(
          ownerId,
          item.text,
          item.sort_order ?? items.value.indexOf(item),
          item.arc_id ?? null,
          item.depends_on ?? null
        );
        item.id = createdId;
      } else {
        await api.updateTodo(item.id, item.text);
      }
    } catch (e: unknown) {
      console.error('Ошибка сохранения задачи:', e);
      const msg = e instanceof Error ? e.message : String(e);
      await appAlert(`Не удалось сохранить задачу: ${msg}`, 'Ошибка плана');
    }
  };

  // ─── Status Management ───────────────────────────────────
  const setItemStatus = async (item: PlanItem, newStatus: TodoStatus) => {
    const oldStatus = item.status;
    const oldDone = item.done;
    item.status = newStatus;
    item.done = newStatus === 'done';

    // Оптимистичная каскадная разблокировка
    if (newStatus === 'done') {
      items.value.forEach(other => {
        if (other.depends_on === item.id && other.status === 'blocked') {
          other.status = 'planned';
        }
      });
    }

    try {
      if (item.id) {
        await api.setTodoStatus(item.id, newStatus);
      } else {
        await saveItem(item);
      }
    } catch (e: unknown) {
      item.status = oldStatus;
      item.done = oldDone;
      console.error('Ошибка изменения статуса задачи:', e);
      const msg = e instanceof Error ? e.message : String(e);
      await appAlert(`Не удалось обновить статус: ${msg}`, 'Ошибка статуса');
    }
  };

  // ─── Toggle (Клик по статусу) ─────────────────────────────
  const toggleItem = async (item: PlanItem) => {
    if (item.status === 'blocked') {
      await appAlert('Эта задача ожидает выполнения предшественника и заблокирована 🔒', 'Задача заблокирована');
      return;
    }

    // Циклический переход: planned -> in_progress -> done -> planned
    let nextStatus: TodoStatus;
    if (item.status === 'planned') {
      nextStatus = 'done';
    } else if (item.status === 'in_progress') {
      nextStatus = 'done';
    } else {
      nextStatus = 'planned';
    }

    await setItemStatus(item, nextStatus);
  };

  // ─── Add ─────────────────────────────────────────────────
  const addItem = async () => {
    const defaultArc = activeArcFilter.value || (props.parentType === 'arc' ? props.parentId : null);
    const newItem: PlanItem = {
      id: '',
      text: '',
      done: false,
      status: 'planned',
      indent: 0,
      sort_order: items.value.length,
      arc_id: defaultArc ?? null,
    };
    items.value.push(newItem);
    await nextTick();
    const inputs = listEl.value?.querySelectorAll<HTMLInputElement>('.plan-text');
    if (inputs?.length) inputs[inputs.length - 1].focus();
  };

  const addItemAfter = async (idx: number, indent: number) => {
    const defaultArc = items.value[idx]?.arc_id || activeArcFilter.value || null;
    const newItem: PlanItem = {
      id: '',
      text: '',
      done: false,
      status: 'planned',
      indent: indent,
      sort_order: idx + 1,
      arc_id: defaultArc,
    };
    if (items.value[idx]) await saveItem(items.value[idx]);

    items.value.splice(idx + 1, 0, newItem);
    items.value.forEach((it, i) => { it.sort_order = i; });

    await nextTick();
    const inputs = listEl.value?.querySelectorAll<HTMLInputElement>('.plan-text');
    if (inputs?.[idx + 1]) inputs[idx + 1].focus();
  };

  // ─── Indent ──────────────────────────────────────────────
  const indentItem = async (item: PlanItem, delta: number) => {
    item.indent = Math.max(0, Math.min(4, (item.indent || 0) + delta));
    await saveItem(item);
  };

  // ─── Delete ──────────────────────────────────────────────
  const deleteItem = async (item: PlanItem, idx: number) => {
    items.value.splice(idx, 1);
    if (item.id) {
      try {
        await api.deleteTodo(item.id);
      } catch (err) {
        console.warn('[usePlanningPanel] Failed to delete todo item:', err);
      }
    }
    items.value.forEach((it, i) => { it.sort_order = i; });
  };

  const onDeleteKey = async (e: KeyboardEvent, item: PlanItem, idx: number) => {
    if (item.text === '' && e.key === 'Backspace') {
      e.preventDefault();
      await deleteItem(item, idx);
      await nextTick();
      const inputs = listEl.value?.querySelectorAll<HTMLInputElement>('.plan-text');
      if (inputs?.[idx - 1]) inputs[idx - 1].focus();
    }
  };

  // ─── Arc Filter & Projection ─────────────────────────────
  const setArcFilter = (arcId: string | null) => {
    activeArcFilter.value = arcId;
  };

  const filteredItems = computed(() => {
    if (!activeArcFilter.value) return items.value;
    return items.value.filter(i => i.arc_id === activeArcFilter.value);
  });

  return {
    items,
    filteredItems,
    activeArcFilter,
    listEl,
    saving,
    nodeIcon,
    nodeName,
    doneCount,
    inProgressCount,
    progressPct,
    load,
    saveItem,
    toggleItem,
    setItemStatus,
    setArcFilter,
    addItem,
    addItemAfter,
    indentItem,
    deleteItem,
    onDeleteKey,
  };
}
