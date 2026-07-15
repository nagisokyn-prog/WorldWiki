/**
 * @file useTreeSelection.ts
 * @description Composable для управления выделением в древовидных списках.
 * Поддерживает: одиночный клик, Ctrl+Click (тогл), Shift+Click (диапазон).
 * Переиспользуется для глав, сущностей и любых других списков.
 *
 * Использование:
 *   const { selected, isSelected, handleClick, deleteSelected, clearSelection, selectedCount } =
 *     useTreeSelection({ onDelete: async (ids) => { ... } });
 *
 *   В шаблоне:
 *   @click="handleClick($event, item, flatItems)"
 *   :class="{ selected: isSelected(item.id) }"
 */

import { ref, computed } from 'vue';

export interface TreeSelectionOptions {
  onDelete?: (ids: any[]) => Promise<void> | void;
  onSelectionChange?: (ids: any[]) => void;
}

export function useTreeSelection(options: TreeSelectionOptions = {}) {
  const { onDelete, onSelectionChange } = options;
  const selected = ref(new Set<any>());
  const lastSelectedId = ref<any>(null);

  // ─── Computed ─────────────────────────────────────────

  const selectedCount = computed(() => selected.value.size);
  const hasSelection = computed(() => selected.value.size > 0);
  const selectedIds = computed(() => [...selected.value]);

  // ─── Helpers ──────────────────────────────────────────

  const isSelected = (id: any) => selected.value.has(id);

  const notify = () => {
    onSelectionChange?.([...selected.value]);
  };

  // ─── Click handler ────────────────────────────────────

  /**
   * Обрабатывает клик с учётом Ctrl и Shift.
   * @param {MouseEvent} event
   * @param {Object} item - элемент с полем id
   * @param {Object[]} flatItems - все видимые элементы в порядке отображения (для Shift-range)
   */
  const handleClick = (event: MouseEvent | { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean }, item: any, flatItems: any[]) => {
    const id = item.id;

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: тогл одного элемента
      const next = new Set(selected.value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      selected.value = next;
      lastSelectedId.value = id;

    } else if (event.shiftKey && lastSelectedId.value) {
      // Shift+Click: диапазон от последнего выбранного до текущего
      const ids = flatItems.map((i: any) => i.id);
      const fromIdx = ids.indexOf(lastSelectedId.value);
      const toIdx = ids.indexOf(id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const lo = Math.min(fromIdx, toIdx);
        const hi = Math.max(fromIdx, toIdx);
        const next = new Set(selected.value);
        ids.slice(lo, hi + 1).forEach((rid: any) => next.add(rid));
        selected.value = next;
      }
      // lastSelectedId не меняем при Shift

    } else {
      // Обычный клик: единственный выбор
      selected.value = new Set([id]);
      lastSelectedId.value = id;
    }

    notify();
  };

  // ─── Selection control ───────────────────────────────

  const clearSelection = () => {
    selected.value = new Set();
    lastSelectedId.value = null;
    notify();
  };

  const selectAll = (flatItems: any[]) => {
    selected.value = new Set(flatItems.map((i: any) => i.id));
    notify();
  };

  const addToSelection = (id: any) => {
    const next = new Set(selected.value);
    next.add(id);
    selected.value = next;
    lastSelectedId.value = id;
    notify();
  };

  // ─── Delete ───────────────────────────────────────────

  /**
   * Удаляет все выделенные элементы. Без confirm.
   */
  const deleteSelected = async () => {
    if (!selected.value.size) return;
    const ids = [...selected.value];
    selected.value = new Set();
    lastSelectedId.value = null;
    notify();
    await onDelete?.(ids);
  };

  // ─── Keyboard handler ─────────────────────────────────

  /**
   * Вешается на контейнер с tabindex=0.
   * Обрабатывает Delete / Backspace → удалить выделенное.
   * Escape → снять выделение.
   * Ctrl+A → выбрать всё.
   */
  const handleKeydown = async (event: KeyboardEvent, flatItems: any[]) => {
    // Если фокус в текстовом поле — не перехватываем системные клавиши
    const target = event.target;
    const isInput = (target as HTMLElement).tagName === 'INPUT' || (target as HTMLElement).tagName === 'TEXTAREA' || (target as HTMLElement).isContentEditable;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (isInput) return; // Печатаем, не удаляем

      if (selected.value.size > 0) {
        event.preventDefault();
        await deleteSelected();
      }
    } else if (event.key === 'Escape') {
      clearSelection();
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      event.preventDefault();
      selectAll(flatItems);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (isInput) return;
      event.preventDefault();
      if (!flatItems || flatItems.length === 0) return;

      const ids = flatItems.map((i: any) => i.id);
      let idx = ids.indexOf(lastSelectedId.value);

      if (idx === -1) {
        idx = event.key === 'ArrowDown' ? 0 : ids.length - 1;
      } else {
        idx = event.key === 'ArrowDown' ? idx + 1 : idx - 1;
      }

      if (idx >= 0 && idx < ids.length) {
        const targetItem = flatItems[idx];
        handleClick({ shiftKey: event.shiftKey, ctrlKey: false }, targetItem, flatItems);

        // Пытаемся прокрутить
        setTimeout(() => {
          // Ищем элемент с классом selected (первый попавшийся может быть не тем, но обычно работает)
          // Или генерируем событие
          const el = document.querySelector(`[data-id="${targetItem.id}"]`) || document.querySelector('.tree-item.selected');
          if (el) el.scrollIntoView({ block: 'nearest' });
        }, 10);
      }
    }
  };

  return {
    // State
    selected,
    selectedCount,
    hasSelection,
    selectedIds,
    lastSelectedId,
    // Methods
    isSelected,
    handleClick,
    clearSelection,
    selectAll,
    addToSelection,
    deleteSelected,
    handleKeydown,
  };
}
