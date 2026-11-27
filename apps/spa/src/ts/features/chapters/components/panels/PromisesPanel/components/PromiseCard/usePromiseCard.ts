import { computed, ref } from 'vue';
import type { PromiseCardProps, PromiseCardEmitFn } from './PromiseCard.model';

export function usePromiseCard(
  props: PromiseCardProps,
  emit: PromiseCardEmitFn
) {
  const localCollapsed = ref(true);

  const isCardCollapsed = computed(() =>
    props.expanded !== undefined ? !props.expanded : localCollapsed.value
  );

  const toggleCollapsed = () => {
    if (props.expanded !== undefined) {
      emit('toggleExpand');
    } else {
      localCollapsed.value = !localCollapsed.value;
    }
  };

  const formatBlockBadgeId = (id: string) => {
    const clean = String(id).replace(/^(text_blocks|blocks):/i, '').trim();
    const blkMatch = clean.match(/^(blk_)([a-zA-Z0-9-]{4,})$/i);
    return blkMatch ? `${blkMatch[1]}${blkMatch[2].slice(0, 3)}` : clean;
  };

  const collapsedBlockBadge = computed(() => {
    const blocks = props.item.block_ids;
    if (Array.isArray(blocks) && blocks.length > 0) {
      return blocks.length === 1
        ? formatBlockBadgeId(blocks[0])
        : `${formatBlockBadgeId(blocks[0])}..${formatBlockBadgeId(blocks[blocks.length - 1])}`;
    }
    return props.item.block_id ? formatBlockBadgeId(props.item.block_id) : null;
  });

  const timeNatureIcon = computed(() => {
    const tn = props.item.time_nature;
    if (tn === 'flashback') return '⏪';
    if (tn === 'flashforward') return '⏩';
    if (tn === 'dream' || tn === 'memory') return '💭';
    return '';
  });

  const participantCount = computed(() =>
    Array.isArray(props.item.participant_ids) ? props.item.participant_ids.length : 0
  );

  const arcCount = computed(() => {
    if (Array.isArray(props.item.arcs) && props.item.arcs.length > 0) return props.item.arcs.length;
    return props.item.arc_id ? 1 : 0;
  });

  const progressionCount = computed(() =>
    Array.isArray(props.item.progressions) ? props.item.progressions.length : 0
  );

  const hasResolution = computed(() => Boolean(props.item.resolution));

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
    collapsedBlockBadge,
    timeNatureIcon,
    participantCount,
    arcCount,
    progressionCount,
    hasResolution,
    toggleCollapsed,
    handleLocate,
    handleRemove
  };
}
