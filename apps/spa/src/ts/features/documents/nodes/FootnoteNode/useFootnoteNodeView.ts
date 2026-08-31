import { computed, ref } from 'vue';
import type { FootnoteNodeViewProps } from './FootnoteNodeView.model';

export function useFootnoteNodeView(props: FootnoteNodeViewProps) {
  const isOpen = ref(false);

  const footnoteNumber = computed(() => props.node.attrs.computedNumber || 1);
  const footnoteText = computed(() => props.node.attrs.content || '');

  function togglePopover(e: MouseEvent) {
    e.stopPropagation();
    isOpen.value = !isOpen.value;
  }

  function closePopover() {
    isOpen.value = false;
  }

  function updateContent(newContent: string) {
    props.updateAttributes({ content: newContent });
  }

  return {
    isOpen,
    footnoteNumber,
    footnoteText,
    togglePopover,
    closePopover,
    updateContent
  };
}
