import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import type { VolumeBacklogSectionProps, VolumeBacklogSectionEmits } from './VolumeBacklogSection.model';

export function useVolumeBacklogSection(props: VolumeBacklogSectionProps, emit: VolumeBacklogSectionEmits) {
  const isExpanded = ref(true);
  const isAdding = ref(false);
  const newText = ref('');
  const inputRef = ref<HTMLInputElement | null>(null);
  const activeMoveItemId = ref<string | null>(null);

  function toggleExpanded() {
    isExpanded.value = !isExpanded.value;
  }

  function startAdding() {
    isAdding.value = true;
    newText.value = '';
    nextTick(() => inputRef.value?.focus());
  }

  function cancelAdd() {
    isAdding.value = false;
    newText.value = '';
  }

  function submitAdd() {
    const text = newText.value.trim();
    if (text) {
      emit('add-backlog', { ownerId: props.volumeId || '', text });
    }
    cancelAdd();
  }

  function toggleMoveMenu(todoId: string) {
    activeMoveItemId.value = activeMoveItemId.value === todoId ? null : todoId;
  }

  function closeMoveMenu() {
    activeMoveItemId.value = null;
  }

  function moveToChapter(todoId: string, chapterId: string) {
    emit('move-to-chapter', { todoId, targetChapterId: chapterId });
    closeMoveMenu();
  }

  function handleDocumentClick() {
    if (activeMoveItemId.value) {
      closeMoveMenu();
    }
  }

  onMounted(() => {
    window.addEventListener('click', handleDocumentClick);
  });

  onUnmounted(() => {
    window.removeEventListener('click', handleDocumentClick);
  });

  return {
    isExpanded,
    isAdding,
    newText,
    inputRef,
    activeMoveItemId,
    toggleExpanded,
    startAdding,
    cancelAdd,
    submitAdd,
    toggleMoveMenu,
    closeMoveMenu,
    moveToChapter
  };
}

