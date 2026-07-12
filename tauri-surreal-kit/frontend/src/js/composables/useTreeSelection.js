/**
 * @file useTreeSelection.js
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

/**
 * @param {Object} options
 * @param {Function} options.onDelete - async (ids: string[]) => void, вызывается при удалении
 * @param {Function} [options.onSelectionChange] - (ids: string[]) => void, при изменении выделения
 */
export function useTreeSelection({ onDelete, onSelectionChange } = {}) {
  const selected = ref(new Set());
  const lastSelectedId = ref(null);

  // ─── Computed ─────────────────────────────────────────

  const selectedCount = computed(() => selected.value.size);
  const hasSelection  = computed(() => selected.value.size > 0);
  const selectedIds   = computed(() => [...selected.value]);

  // ─── Helpers ──────────────────────────────────────────

  const isSelected = (id) => selected.value.has(id);

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
  const handleClick = (event, item, flatItems) => {
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
      const ids = flatItems.map(i => i.id);
      const fromIdx = ids.indexOf(lastSelectedId.value);
      const toIdx   = ids.indexOf(id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const lo = Math.min(fromIdx, toIdx);
        const hi = Math.max(fromIdx, toIdx);
        const next = new Set(selected.value);
        ids.slice(lo, hi + 1).forEach(rid => next.add(rid));
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

  const selectAll = (flatItems) => {
    selected.value = new Set(flatItems.map(i => i.id));
    notify();
  };

  const addToSelection = (id) => {
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
  const handleKeydown = async (event, flatItems) => {
    // Если фокус в текстовом поле — не перехватываем системные клавиши
    const target = event.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    
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
