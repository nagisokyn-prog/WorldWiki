import { ref } from 'vue';
import type { PromiseCardProps, PromiseCardEmits } from './PromiseCard.model';

export function usePromiseCard(
  props: PromiseCardProps,
  emit: PromiseCardEmits
) {
  const isCardCollapsed = ref(false);

  const toggleCollapsed = () => {
    isCardCollapsed.value = !isCardCollapsed.value;
  };

  const handleLocate = () => {
    emit('locate', {
      chapter_id: props.item.chapter_id,
      paragraph_index: props.item.paragraph_index,
      quote: props.item.quote,
      block_id: props.item.block_id || null
    });
  };

  const handleRemove = () => {
    emit('remove', props.item);
  };

  return {
    isCardCollapsed,
    toggleCollapsed,
    handleLocate,
    handleRemove
  };
}
