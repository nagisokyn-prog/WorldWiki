import { computed, ref } from 'vue';
import type { PromiseMilestone, RichPlotPromise } from '../../../../usePromisesPanel';
import type { PromiseMilestoneCardEmits, PromiseMilestoneCardProps } from './PromiseMilestoneCard.model';

function cleanBlockLabel(raw?: string | null): string | null {
  if (!raw) return null;
  const stripped = String(raw).replace(/^(text_blocks|blocks):/i, '').replace(/[`⟨⟩"']/g, '').trim();
  const pm = stripped.match(/(para-\d+)$/i);
  if (pm) return pm[1];
  const short = stripped.replace(/^blk_[^_]+_/, '');
  const blkMatch = short.match(/^(blk_)([a-zA-Z0-9-]{4,})$/i);
  return blkMatch ? `${blkMatch[1]}${blkMatch[2].slice(0, 3)}` : short;
}

export function usePromiseMilestoneCard(
  props: PromiseMilestoneCardProps,
  emit: PromiseMilestoneCardEmits
) {
  const isCollapsed = ref(true);
  const toggleCollapsed = () => {
    isCollapsed.value = !isCollapsed.value;
  };

  const stageIcon = computed(() => (props.stage === 'resolution' ? '🎯' : '🌿'));

  const collapsedBlockBadge = computed(() => {
    const blocks = props.milestone.block_ids;
    if (Array.isArray(blocks) && blocks.length > 0) {
      const cleaned = blocks.map(cleanBlockLabel).filter((b): b is string => Boolean(b));
      if (cleaned.length > 1) return `${cleaned[0]}..${cleaned[cleaned.length - 1]}`;
      if (cleaned.length === 1) return cleaned[0];
    }
    return cleanBlockLabel(props.milestone.block_id);
  });

  const participantCount = computed(() =>
    Array.isArray(props.milestone.participant_ids) ? props.milestone.participant_ids.length : 0
  );

  const arcCount = computed(() =>
    Array.isArray(props.milestone.arcs) ? props.milestone.arcs.length : 0
  );

  const timeNatureIcon = computed(() => {
    if (props.milestone.time_nature === 'flashback' || props.milestone.is_flashback) return '⏪';
    if (props.milestone.time_nature === 'flashforward') return '⏩';
    if (props.milestone.time_nature === 'dream' || props.milestone.time_nature === 'memory') return '💭';
    return '';
  });

  const cleanBlocks = computed(() => {
    const blocks = props.milestone.block_ids;
    if (Array.isArray(blocks) && blocks.length > 0) {
      return blocks.map(cleanBlockLabel).filter((b): b is string => Boolean(b));
    }
    const single = cleanBlockLabel(props.milestone.block_id);
    return single ? [single] : [];
  });

  const milestoneAsPromise = computed<RichPlotPromise>(() => ({
    ...props.parentItem,
    id: props.milestone.milestone_id || `${props.parentItem.id || 'ms'}_${props.stage}`,
    chapter_id: props.milestone.chapter_id || props.parentItem.chapter_id,
    quote: props.milestone.quote || '',
    title: props.milestone.quote || props.parentItem.title,
    paragraph_index: props.milestone.order_index ?? 1,
    block_id: cleanBlocks.value[0] || null,
    block_ids: cleanBlocks.value,
    location_id: props.milestone.location_id ?? null,
    timeline_event_id: props.milestone.timeline_event_id ?? null,
    m_abs: props.milestone.m_abs ?? null,
    calendar_id: props.milestone.calendar_id ?? null,
    participant_ids: Array.isArray(props.milestone.participant_ids) ? props.milestone.participant_ids : [],
    arcs: Array.isArray(props.milestone.arcs) ? props.milestone.arcs : [],
    arc_id: props.milestone.arcs?.[0]?.arc_id ?? null,
    arc_phase: props.milestone.arcs?.[0]?.arc_phase ?? null,
    time_nature: props.milestone.time_nature ?? 'present',
    is_flashback: Boolean(props.milestone.is_flashback),
  }));

  const matchesMilestone = (m: PromiseMilestone): boolean => {
    if (props.milestone.milestone_id && m.milestone_id) {
      return m.milestone_id === props.milestone.milestone_id;
    }
    return m.stage === props.stage && m.block_id === props.milestone.block_id;
  };

  const handleMetaUpdate = (updatedProxy: RichPlotPromise) => {
    const patch: Partial<PromiseMilestone> = {
      location_id: updatedProxy.location_id ?? null,
      timeline_event_id: updatedProxy.timeline_event_id ?? null,
      m_abs: updatedProxy.m_abs ?? null,
      calendar_id: updatedProxy.calendar_id ?? null,
      participant_ids: Array.isArray(updatedProxy.participant_ids) ? updatedProxy.participant_ids : [],
      arcs: Array.isArray(updatedProxy.arcs) ? updatedProxy.arcs : [],
      time_nature: updatedProxy.time_nature ?? 'present',
      is_flashback: Boolean(updatedProxy.is_flashback),
      block_ids: Array.isArray(updatedProxy.block_ids) ? updatedProxy.block_ids : [],
    };

    const nextMilestones = (props.parentItem.milestones || []).map((m) =>
      matchesMilestone(m) ? { ...m, ...patch } : m
    );
    const nextProgressions = (props.parentItem.progressions || []).map((m) =>
      matchesMilestone(m) ? { ...m, ...patch } : m
    );
    const nextResolution =
      props.parentItem.resolution && matchesMilestone(props.parentItem.resolution)
        ? { ...props.parentItem.resolution, ...patch }
        : props.parentItem.resolution;

    emit('update:item', {
      ...props.parentItem,
      milestones: nextMilestones,
      progressions: nextProgressions,
      resolution: nextResolution,
    });
  };

  const handleLocate = () => {
    emit('locateStep', {
      chapter_id: props.milestone.chapter_id || '',
      paragraph_index: props.milestone.order_index ?? 1,
      quote: props.milestone.quote || '',
    });
  };

  const handleRemove = () => {
    emit('removeMilestone', {
      item: props.parentItem,
      milestoneId: props.milestone.milestone_id || '',
      stage: props.stage,
    });
  };

  return {
    isCollapsed,
    toggleCollapsed,
    stageIcon,
    collapsedBlockBadge,
    participantCount,
    arcCount,
    timeNatureIcon,
    milestoneAsPromise,
    handleMetaUpdate,
    handleLocate,
    handleRemove,
  };
}
