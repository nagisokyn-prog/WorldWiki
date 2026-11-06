import { ref, type Ref } from 'vue';
import type {
  InspectorChapter,
  FormattedInspectorEvent,
  TimelineInspectorEmits,
} from './TimelineInspector.model';
import { normalizeId } from './timelineInspector.utils';

export function useTimelineInspectorNavigation(
  filteredChapters: Ref<InspectorChapter[]>,
  formattedEvents: Ref<FormattedInspectorEvent[]>,
  emit?: TimelineInspectorEmits
) {
  const activeChapterId = ref<string | null>(null);
  const hoveredChapterId = ref<string | null>(null);
  const hoveredEventId = ref<string | null>(null);
  const pingedEventId = ref<string | null>(null);

  const scrollToEvent = (eventId: string) => {
    const cleanId = normalizeId(eventId);
    pingedEventId.value = cleanId;
    setTimeout(() => {
      const el = document.querySelector(`[data-event-id="${cleanId}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
    setTimeout(() => {
      if (pingedEventId.value === cleanId) pingedEventId.value = null;
    }, 2500);
  };

  const scrollToChapter = (chapterId: string) => {
    const cleanId = normalizeId(chapterId);
    setTimeout(() => {
      const el = document.querySelector(`[data-chapter-id="${cleanId}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
  };

  const selectChapter = (ch: InspectorChapter) => {
    const cleanId = normalizeId(ch.id);
    if (activeChapterId.value === cleanId) {
      activeChapterId.value = null;
    } else {
      activeChapterId.value = cleanId;
      const targetEv = formattedEvents.value.find((ev) =>
        ev.reveals?.some((r) => normalizeId(r.chapter_id) === cleanId)
      );
      if (targetEv) scrollToEvent(targetEv.id);
    }
  };

  const jumpToFlashback = (ch: InspectorChapter, e?: Event) => {
    if (e) e.stopPropagation();
    if (ch.earliestFlashbackEventId) {
      activeChapterId.value = normalizeId(ch.id);
      scrollToEvent(ch.earliestFlashbackEventId);
    }
  };

  const getTargetChId = () =>
    activeChapterId.value
      ? normalizeId(activeChapterId.value)
      : hoveredChapterId.value
        ? normalizeId(hoveredChapterId.value)
        : null;

  const isEventHighlighted = (ev: FormattedInspectorEvent): boolean => {
    if (hoveredEventId.value && normalizeId(ev.id) === normalizeId(hoveredEventId.value)) return true;
    const targetChId = getTargetChId();
    return targetChId ? ev.reveals?.some((r) => normalizeId(r.chapter_id) === targetChId) || false : false;
  };

  const isEventDimmed = (ev: FormattedInspectorEvent): boolean => {
    const targetChId = getTargetChId();
    return targetChId ? !ev.reveals?.some((r) => normalizeId(r.chapter_id) === targetChId) : false;
  };

  const navigateToChapter = (chapterIdOrObj: string | InspectorChapter) => {
    const chId = typeof chapterIdOrObj === 'string' ? chapterIdOrObj : chapterIdOrObj.id;
    const cleanId = normalizeId(chId);
    const title =
      typeof chapterIdOrObj === 'string'
        ? filteredChapters.value.find((c) => normalizeId(c.id) === cleanId)?.title || `Глава ${cleanId}`
        : chapterIdOrObj.title;
    if (emit) emit('open-chapter', { id: cleanId, title });
  };

  const navigateToScene = (ev: FormattedInspectorEvent) => {
    const reveal = ev.reveals?.[0];
    if (!reveal?.chapter_id) return;
    const cleanChId = normalizeId(reveal.chapter_id);
    const title = reveal.chapter_title || `Глава ${cleanChId}`;
    if (emit) emit('open-chapter', { id: cleanChId, title });
    setTimeout(() => {
      document.dispatchEvent(
        new CustomEvent('ww:locate-promise', {
          detail: {
            chapterId: cleanChId,
            paragraphIndex: 1,
            quote: ev.title,
            blockId: reveal.block_id || undefined,
          },
        })
      );
    }, 150);
  };

  return {
    activeChapterId,
    hoveredChapterId,
    hoveredEventId,
    pingedEventId,
    scrollToEvent,
    scrollToChapter,
    selectChapter,
    jumpToFlashback,
    isEventHighlighted,
    isEventDimmed,
    navigateToChapter,
    navigateToScene,
  };
}

