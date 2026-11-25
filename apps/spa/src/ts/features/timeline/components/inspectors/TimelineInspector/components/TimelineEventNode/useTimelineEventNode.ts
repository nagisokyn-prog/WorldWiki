import type { FormattedInspectorEvent } from '../../TimelineInspector.model';
import { normalizeId } from '../../timelineInspector.utils';
import type { TimelineEventNodeEmits, TimelineEventNodeProps } from './TimelineEventNode.model';

export function useTimelineEventNode(
  props: TimelineEventNodeProps,
  emit: TimelineEventNodeEmits
) {
  const cleanLocationLabel = (locationId?: string | null, locationName?: string) =>
    locationName || (locationId ? locationId.replace(/^(entities|locations):/, '') : '');

  const isPinged = (ev: FormattedInspectorEvent) =>
    props.pingedEventId === normalizeId(ev.id);

  const onHoverEvent = (id: string | null) => emit('hover-event', id);
  const onNavigateScene = (ev: FormattedInspectorEvent) => emit('navigate-scene', ev);
  const onScrollChapter = (chapterId: string) => emit('scroll-chapter', chapterId);
  const onScrollEvent = (eventId: string) => emit('scroll-event', eventId);

  return {
    normalizeId,
    cleanLocationLabel,
    isPinged,
    onHoverEvent,
    onNavigateScene,
    onScrollChapter,
    onScrollEvent,
  };
}
