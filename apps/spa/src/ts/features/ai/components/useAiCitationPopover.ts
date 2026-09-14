import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { AiCitationPopoverProps, AiCitationPopoverEmits } from './AiCitation.model';

export function useAiCitationPopover(
  props: AiCitationPopoverProps,
  emit: AiCitationPopoverEmits
) {
  const popoverRef = ref<HTMLElement | null>(null);

  const popoverStyle = computed(() => {
    if (!props.anchorEl) return {};
    const rect = props.anchorEl.getBoundingClientRect();
    return {
      left: `${Math.min(window.innerWidth - 320, Math.max(10, rect.left - 100))}px`,
      top: `${rect.bottom + 8}px`,
    };
  });

  const handleClickOutside = (e: MouseEvent) => {
    if (props.isOpen && popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
      if (props.anchorEl && props.anchorEl.contains(e.target as Node)) return;
      emit('close');
    }
  };

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  const close = () => {
    emit('close');
  };

  const askSource = () => {
    emit('ask-source', props.citation);
  };

  return {
    popoverRef,
    popoverStyle,
    handleClickOutside,
    close,
    askSource,
  };
}
