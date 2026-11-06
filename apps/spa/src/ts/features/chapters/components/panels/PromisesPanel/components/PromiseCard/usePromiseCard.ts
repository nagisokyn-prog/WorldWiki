import { ref } from 'vue';
import type { PromiseCardProps, PromiseCardEmitFn } from './PromiseCard.model';

export function usePromiseCard(
  props: PromiseCardProps,
  emit: PromiseCardEmitFn
) {
  const isCardCollapsed = ref(false);

  const toggleCollapsed = () => {
    isCardCollapsed.value = !isCardCollapsed.value;
  };

  const handleLocate = () => {
    emit('locate', {
      chapter_id: props.item.chapter_id || '',
      paragraph_index: props.item.paragraph_index || 1,
      quote: props.item.quote || props.item.title || '',
      block_id: props.item.block_id || null,
      block_ids: props.item.block_ids && props.item.block_ids.length > 0 ? props.item.block_ids : (props.item.block_id ? [props.item.block_id] : [])
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
