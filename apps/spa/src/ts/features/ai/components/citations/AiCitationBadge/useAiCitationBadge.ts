import { ref } from 'vue';
import type { CitationItem } from '../AiCitation.model';

export function useAiCitationBadge(
  emit: (e: 'ask-source', citation: CitationItem) => void
) {
  const badgeRef = ref<HTMLElement | null>(null);
  const isPopoverOpen = ref(false);

  const togglePopover = () => {
    isPopoverOpen.value = !isPopoverOpen.value;
  };

  const onAskSource = (item: CitationItem) => {
    emit('ask-source', item);
    isPopoverOpen.value = false;
  };

  const closePopover = () => {
    isPopoverOpen.value = false;
  };

  return {
    badgeRef,
    isPopoverOpen,
    togglePopover,
    onAskSource,
    closePopover
  };
}
