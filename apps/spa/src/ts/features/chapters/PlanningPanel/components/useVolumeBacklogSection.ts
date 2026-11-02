import { ref, nextTick } from 'vue';
import type { VolumeBacklogSectionProps, VolumeBacklogSectionEmits } from './VolumeBacklogSection.model';

export function useVolumeBacklogSection(props: VolumeBacklogSectionProps, emit: VolumeBacklogSectionEmits) {
  const isExpanded = ref(true);
  const isAdding = ref(false);
  const newText = ref('');
  const inputRef = ref<HTMLInputElement | null>(null);

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
    if (text && props.volumeId) {
      emit('add-backlog', { ownerId: props.volumeId, text });
    }
    cancelAdd();
  }

  return {
    isExpanded,
    isAdding,
    newText,
    inputRef,
    toggleExpanded,
    startAdding,
    cancelAdd,
    submitAdd
  };
}
