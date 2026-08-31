import { computed, ref } from 'vue';
import type { DocumentLayoutBarProps, DocumentViewMode } from './DocumentLayoutBar.model';

export function useDocumentLayoutBar(props: DocumentLayoutBarProps) {
  const currentMode = ref<DocumentViewMode>(props.initialMode || 'page');
  const isRulerVisible = ref(props.initialRulerVisible ?? true);

  const isPageMode = computed(() => currentMode.value === 'page');

  function setMode(mode: DocumentViewMode) {
    currentMode.value = mode;
    if (!props.editor) return;

    if (mode === 'page') {
      props.editor.commands.enablePagination?.();
    } else {
      props.editor.commands.disablePagination?.();
    }
  }

  function toggleRuler() {
    isRulerVisible.value = !isRulerVisible.value;
    if (!props.editor) return;

    if (isRulerVisible.value) {
      props.editor.commands.showRuler?.();
    } else {
      props.editor.commands.hideRuler?.();
    }
  }

  return {
    currentMode,
    isPageMode,
    isRulerVisible,
    setMode,
    toggleRuler
  };
}
