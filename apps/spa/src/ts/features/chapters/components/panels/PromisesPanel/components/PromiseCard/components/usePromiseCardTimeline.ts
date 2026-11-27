import { computed } from 'vue';
import type { PromiseCardTimelineProps } from '../PromiseCard.model';
import type { RichPlotPromise, PromiseMilestone } from '@/types/narrative';

export function usePromiseCardTimeline(props: PromiseCardTimelineProps) {
  const milestoneToPrevScene = (m: PromiseMilestone): RichPlotPromise => ({
    ...props.item,
    id: m.milestone_id || m.id || props.item.id,
    chapter_id: m.chapter_id || props.item.chapter_id,
    location_id: m.location_id ?? null,
    timeline_event_id: m.timeline_event_id ?? null,
    m_abs: m.m_abs ?? null,
    calendar_id: m.calendar_id ?? null,
    participant_ids: Array.isArray(m.participant_ids) ? m.participant_ids : [],
    arcs: Array.isArray(m.arcs) ? m.arcs : [],
    time_nature: m.time_nature ?? 'present',
    is_flashback: Boolean(m.is_flashback)
  });

  const hasUsefulContext = (p?: RichPlotPromise | null) =>
    Boolean(p && (p.m_abs != null || p.location_id || (p.participant_ids && p.participant_ids.length > 0) || (p.arcs && p.arcs.length > 0)));

  const getProgressionPrevious = (pIdx: number): RichPlotPromise | null => {
    const progs = props.item.progressions || [];
    if (pIdx > 0) {
      const prevProg = milestoneToPrevScene(progs[pIdx - 1]);
      if (hasUsefulContext(prevProg)) return prevProg;
    }
    if (hasUsefulContext(props.item)) return props.item;
    return props.previousScene || props.item;
  };

  const resolutionPrevious = computed<RichPlotPromise | null>(() => {
    const progs = props.item.progressions || [];
    if (progs.length > 0) {
      const lastProg = milestoneToPrevScene(progs[progs.length - 1]);
      if (hasUsefulContext(lastProg)) return lastProg;
    }
    if (hasUsefulContext(props.item)) return props.item;
    return props.previousScene || props.item;
  });

  return {
    getProgressionPrevious,
    resolutionPrevious
  };
}
