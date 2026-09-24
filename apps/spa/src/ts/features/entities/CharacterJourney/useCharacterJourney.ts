import { ref, computed, watch, onMounted } from 'vue';
import { getCharacterJourney } from '@/services/api.client';
import type {
  CharacterJourneyData,
  JourneyTimelineItem,
  JourneyAppearance,
  JourneyEvent,
  JourneyRelation,
  JourneyPromise,
} from './CharacterJourney.model';

export function useCharacterJourney(projectId: string, entityId: string) {
  const data = ref<CharacterJourneyData | null>(null);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const filterType = ref<string>('all'); // 'all' | 'appearances' | 'events' | 'relations' | 'promises'

  const loadJourney = async () => {
    if (!projectId || !entityId) return;
    isLoading.value = true;
    error.value = null;
    try {
      const raw = await getCharacterJourney(projectId, entityId);
      data.value = (raw as CharacterJourneyData) || {
        appearances: [],
        events: [],
        relations: [],
        promises: [],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error.value = msg;
      console.error('[useCharacterJourney] Error loading journey:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const timelineItems = computed<JourneyTimelineItem[]>(() => {
    if (!data.value) return [];
    const items: JourneyTimelineItem[] = [];

    // 1. Appearances in chapters
    data.value.appearances.forEach((app: JourneyAppearance) => {
      items.push({
        id: `app-${app.chapter_id}`,
        type: 'appearance',
        title: `Появление: ${app.chapter_title}`,
        subtitle: `Глава #${app.chapter_order} (${app.source === 'scene' ? 'Сцена' : 'Упоминание'})`,
        chapter_order: app.chapter_order,
        badge: app.source === 'scene' ? 'Сцена' : 'Упоминание',
        badgeType: app.source === 'scene' ? 'accent' : 'muted',
        description: app.role ? `Роль: ${app.role}` : undefined,
      });
    });

    // 2. Timeline Events (diegetic)
    data.value.events.forEach((ev: JourneyEvent) => {
      items.push({
        id: `ev-${ev.event_id}`,
        type: 'event',
        title: `Событие мира: ${ev.event_title}`,
        subtitle: `M_abs: ${ev.m_abs}`,
        m_abs: ev.m_abs,
        badge: 'Событие мира',
        badgeType: 'warning',
        description: ev.role ? `Участие: ${ev.role}` : undefined,
      });
    });

    // 3. Relations
    data.value.relations.forEach((rel: JourneyRelation) => {
      items.push({
        id: `rel-${rel.id}`,
        type: 'relation_change',
        title: `Связь с «${rel.target_name}» (${rel.rel_type})`,
        subtitle: rel.start_order ? `С главы #${rel.start_order}` : 'С начала',
        chapter_order: rel.start_order,
        badge: `Сила: ${rel.strength ?? 0}`,
        badgeType: (rel.strength ?? 0) >= 0 ? 'success' : 'danger',
      });
    });

    // 4. Plot Promises
    data.value.promises.forEach((p: JourneyPromise) => {
      items.push({
        id: `prom-${p.id}`,
        type: 'promise',
        title: `Сюжетное ружьё (${p.kind}): «${p.quote.slice(0, 50)}...»`,
        subtitle: `Заложено в главе #${p.planted_order ?? '?'}`,
        chapter_order: p.planted_order,
        badge: p.status === 'resolved' ? 'Разряжено' : 'Активно',
        badgeType: p.status === 'resolved' ? 'success' : 'accent',
      });
    });

    // Sort by chapter_order ascending, items without chapter_order sorted by m_abs
    return items
      .filter((item) => {
        if (filterType.value === 'all') return true;
        if (filterType.value === 'appearances') return item.type === 'appearance';
        if (filterType.value === 'events') return item.type === 'event';
        if (filterType.value === 'relations') return item.type === 'relation_change';
        if (filterType.value === 'promises') return item.type === 'promise';
        return true;
      })
      .sort((a, b) => {
        const orderA = a.chapter_order ?? (a.m_abs ? Math.floor(a.m_abs / 1000) : 0);
        const orderB = b.chapter_order ?? (b.m_abs ? Math.floor(b.m_abs / 1000) : 0);
        return orderA - orderB;
      });
  });

  watch(() => [projectId, entityId], loadJourney);
  onMounted(loadJourney);

  return {
    data,
    isLoading,
    error,
    filterType,
    timelineItems,
    refresh: loadJourney,
  };
}
