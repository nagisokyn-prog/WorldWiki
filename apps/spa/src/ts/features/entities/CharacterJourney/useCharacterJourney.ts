import { ref, computed, watch, onMounted } from 'vue';
import { getCharacterJourney, getEntities } from '@/services/api.client';
import { useStoryArcsStore } from '@/stores/story_arcs.store';
import { useCalendarStore } from '@/stores/calendar.store';
import { CalendarMath } from '@/services/Calendars/calendar.math';
import { CalendarFormat } from '@/services/Calendars/calendar.format';
import type { CalendarData, CalendarDate } from '@/services/Calendars/calendar.types';
import type { Entity } from '@/types/generated/Entity';
import type {
  CharacterJourneyData,
  JourneyTimelineItem,
  JourneyEvent,
  JourneyRelation,
  JourneyPromise,
  CharacterJourneyViewMode,
  ArcGroup,
} from './CharacterJourney.model';

export function useCharacterJourney(projectId: string, initialEntityId?: string) {
  const storyArcsStore = useStoryArcsStore();
  const calendarStore = useCalendarStore();
  const currentEntityId = ref<string>(initialEntityId || '');
  const data = ref<CharacterJourneyData | null>(null);
  const entitiesList = ref<Entity[]>([]);
  const calendarData = ref<CalendarData | null>(null);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const viewMode = ref<CharacterJourneyViewMode>('BY_ARCS');
  const selectedArcFilter = ref<string>('ALL'); // 'ALL' | 'UNASSIGNED' | specific arc_id
  const filterType = ref<string>('all'); // 'all' | 'scenes' | 'events' | 'relations' | 'promises'

  const loadCalendars = async () => {
    if (!projectId) {
      calendarData.value = CalendarFormat.getDefaultCalendar();
      return;
    }
    try {
      const cals = await calendarStore.getCalendars(projectId);
      if (cals && cals.length > 0) {
        const master = cals.find((c) => c.is_master) || cals.find((c) => c.is_default) || cals[0];
        calendarData.value = (master?.data as CalendarData) || (master as unknown as CalendarData) || null;
      }
      if (!calendarData.value) {
        calendarData.value = CalendarFormat.getDefaultCalendar();
      }
    } catch (err) {
      console.warn('[useCharacterJourney] Failed to load calendars:', err);
      calendarData.value = CalendarFormat.getDefaultCalendar();
    }
  };

  const loadEntities = async () => {
    if (!projectId) return;
    try {
      const res = await getEntities(projectId, null);
      entitiesList.value = res || [];
      if (!currentEntityId.value && entitiesList.value.length > 0) {
        currentEntityId.value = entitiesList.value[0].id || '';
      }
    } catch (err) {
      console.warn('[useCharacterJourney] Failed to fetch entities list:', err);
    }
  };

  const loadJourney = async () => {
    if (!projectId || !currentEntityId.value) return;
    isLoading.value = true;
    error.value = null;
    try {
      await storyArcsStore.loadArcs(projectId);
      await loadCalendars();
      const raw = await getCharacterJourney(projectId, currentEntityId.value);
      data.value = (raw as CharacterJourneyData) || {
        appearances: [],
        events: [],
        relations: [],
        promises: [],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error.value = msg;
      console.error('[useCharacterJourney ERROR] Error loading journey:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const formatDiegeticDate = (mAbs?: number | null, dateFields?: Record<string, unknown> | null): string | undefined => {
    const hasMabs = mAbs !== undefined && mAbs !== null;
    const hasDateFields = dateFields && typeof dateFields === 'object' && Object.keys(dateFields).length > 0;
    if (!hasMabs && !hasDateFields) return undefined;

    const cal = calendarData.value || CalendarFormat.getDefaultCalendar();
    try {
      let dateInput: CalendarDate['original_input'];
      if (hasDateFields) {
        dateInput = {
          era_index: Number(dateFields.era_index ?? dateFields.era) || 0,
          year: Number(dateFields.year ?? dateFields.год) || 1,
          month: Number(dateFields.month ?? dateFields.месяц) || 0,
          day: Number(dateFields.day ?? dateFields.день) || 1,
          hour: Number(dateFields.hour ?? dateFields.час) || 0,
          minute: Number(dateFields.minute ?? dateFields.минута) || 0,
        };
      } else {
        dateInput = CalendarMath.getDateFromAbsolute(mAbs!, cal);
      }

      const calculatedMabs = hasMabs ? mAbs! : CalendarMath.getAbsoluteMinute(dateInput, cal);

      const calDate: CalendarDate = {
        absolute_minute: calculatedMabs,
        calendar_id: (cal as unknown as { id?: string }).id || 'default',
        original_input: dateInput,
      };

      const formatted = CalendarFormat.formatDate(cal, calDate);
      const season = CalendarFormat.getSeasonForDate(cal, dateInput.year, dateInput.month);
      const hasSeason = season && season !== 'Вне сезона';
      const h = dateInput.hour ?? 0;
      const timeOfDay = h >= 5 && h < 12 ? 'Утро' : h >= 12 && h < 18 ? 'День' : h >= 18 && h < 23 ? 'Вечер' : 'Ночь';

      let fullStr = `⏳ ${formatted}`;
      if (hasSeason) fullStr += ` · ${season}`;
      fullStr += ` · ${timeOfDay}`;
      return fullStr;
    } catch {
      if (hasMabs) {
        const dayNum = Math.floor(mAbs! / 1440) + 1;
        return `⏳ День ${dayNum}`;
      }
      return undefined;
    }
  };

  const pluralize = (num: number, one: string, two: string, five: string): string => {
    const n = Math.abs(num) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return five;
    if (n1 > 1 && n1 < 5) return two;
    if (n1 === 1) return one;
    return five;
  };

  const formatFlashbackDelta = (deltaMinutes: number): string => {
    const years = Math.floor(deltaMinutes / (365 * 1440));
    if (years >= 1) {
      return `⏪ Флэшбек (на ${years} ${pluralize(years, 'год', 'года', 'лет')} назад)`;
    }
    const months = Math.floor(deltaMinutes / (30 * 1440));
    if (months >= 1) {
      return `⏪ Флэшбек (на ${months} ${pluralize(months, 'месяц', 'месяца', 'месяцев')} назад)`;
    }
    const days = Math.floor(deltaMinutes / 1440);
    if (days >= 1) {
      return `⏪ Флэшбек (на ${days} ${pluralize(days, 'день', 'дня', 'дней')} назад)`;
    }
    const hours = Math.floor(deltaMinutes / 60);
    if (hours >= 1) {
      return `⏪ Флэшбек (на ${hours} ${pluralize(hours, 'час', 'часа', 'часов')} назад)`;
    }
    return '⏪ Флэшбек';
  };

  // 1. Все плоские элементы хронологии (сцены, события, связи; упоминания исключены для чистоты)
  const allTimelineItems = computed<JourneyTimelineItem[]>(() => {
    if (!data.value) return [];
    const items: JourneyTimelineItem[] = [];
    const activeCal = calendarData.value || CalendarFormat.getDefaultCalendar();

    const getPhaseLabel = (phase?: string | null): string => {
      switch (phase) {
        case 'setup': return '🌱 Завязка';
        case 'escalation': return '⚡ Эскалация';
        case 'climax': return '🔥 Кульминация';
        case 'resolution': return '✅ Развязка';
        default: return '🌱 Сцена';
      }
    };

    // 1. Global Timeline Events (diegetic M_abs)
    data.value.events.forEach((ev: JourneyEvent) => {
      const formattedDate = formatDiegeticDate(ev.m_abs, null);
      items.push({
        id: `ev-${ev.event_id}`,
        type: 'event',
        title: `Событие мира: ${ev.event_title}`,
        subtitle: formattedDate,
        fullText: ev.event_desc || ev.role || undefined,
        timeLabel: formattedDate,
        phaseLabel: '⏳ Событие',
        m_abs: ev.m_abs,
        badge: 'Событие мира',
        badgeType: 'warning',
        description: ev.event_desc || (ev.role ? `Участие: ${ev.role}` : undefined),
      });
    });

    // 2. Relations
    data.value.relations.forEach((rel: JourneyRelation) => {
      items.push({
        id: `rel-${rel.id}`,
        type: 'relation_change',
        title: `Связь с «${rel.target_name}» (${rel.rel_type})`,
        subtitle: rel.start_order ? `С главы #${rel.start_order}` : 'С начала',
        phaseLabel: '👥 Связь',
        chapter_order: rel.start_order,
        badge: `Сила: ${rel.strength ?? 0}`,
        badgeType: (rel.strength ?? 0) >= 0 ? 'success' : 'danger',
      });
    });

    // 3. Narrative Blocks (Plot Promises / Scenes) with full text and exact diegetic dates
    data.value.promises.forEach((p: JourneyPromise) => {
      // Поддержка нескольких арок на одной сцене:
      // p.arcs: [{ arc_id: '...', arc_phase: '...' }] или одиночный p.arc_id / p.arc_phase
      const boundArcs: Array<{
        arcId: string;
        arcTitle: string;
        arcColor?: string;
        phase: string;
        phaseLabel: string;
      }> = [];
      const allArcIds: string[] = [];

      if (Array.isArray(p.arcs) && p.arcs.length > 0) {
        p.arcs.forEach((rawEntry: unknown) => {
          if (!rawEntry) return;
          let entryArcId = '';
          let entryPhase = 'setup';

          if (typeof rawEntry === 'string') {
            entryArcId = rawEntry;
          } else if (typeof rawEntry === 'object' && rawEntry !== null) {
            const obj = rawEntry as { arc_id?: string; arc_phase?: string };
            entryArcId = obj.arc_id || '';
            entryPhase = obj.arc_phase || 'setup';
          }

          if (entryArcId) {
            const cleanId = entryArcId.replace(/^story_arcs:/, '');
            const arc = storyArcsStore.arcs.find((a) => (a.id || '').replace(/^story_arcs:/, '') === cleanId);
            const resolvedId = arc?.id || entryArcId;
            const resolvedTitle = arc?.title || 'Сюжетная арка';
            const resolvedColor = arc?.color || undefined;

            if (!allArcIds.includes(resolvedId)) {
              allArcIds.push(resolvedId);
            }

            boundArcs.push({
              arcId: resolvedId,
              arcTitle: resolvedTitle,
              arcColor: resolvedColor,
              phase: entryPhase,
              phaseLabel: getPhaseLabel(entryPhase),
            });
          }
        });
      }

      // Если массив arcs пуст, но указан единичный p.arc_id
      if (boundArcs.length === 0 && p.arc_id) {
        const cleanArcId = p.arc_id.replace(/^story_arcs:/, '');
        const arc = storyArcsStore.arcs.find((a) => (a.id || '').replace(/^story_arcs:/, '') === cleanArcId);
        const resolvedId = arc?.id || p.arc_id;
        const resolvedTitle = arc?.title || p.arc_title || 'Сюжетная арка';
        const resolvedColor = arc?.color || p.arc_color || undefined;
        const phase = p.arc_phase || 'setup';

        allArcIds.push(resolvedId);
        boundArcs.push({
          arcId: resolvedId,
          arcTitle: resolvedTitle,
          arcColor: resolvedColor,
          phase,
          phaseLabel: getPhaseLabel(phase),
        });
      }

      const primaryArc = boundArcs[0];
      const combinedArcTitle = boundArcs.length > 0
        ? boundArcs.map((b) => b.arcTitle).join(' & ')
        : p.arc_title;

      let computedMabs = p.m_abs;
      if ((computedMabs === undefined || computedMabs === null) && p.date_fields && typeof p.date_fields === 'object') {
        try {
          const dInput = {
            era_index: Number((p.date_fields as Record<string, unknown>).era_index ?? (p.date_fields as Record<string, unknown>).era) || 0,
            year: Number((p.date_fields as Record<string, unknown>).year ?? (p.date_fields as Record<string, unknown>).год) || 1,
            month: Number((p.date_fields as Record<string, unknown>).month ?? (p.date_fields as Record<string, unknown>).месяц) || 0,
            day: Number((p.date_fields as Record<string, unknown>).day ?? (p.date_fields as Record<string, unknown>).день) || 1,
            hour: Number((p.date_fields as Record<string, unknown>).hour ?? (p.date_fields as Record<string, unknown>).час) || 0,
            minute: Number((p.date_fields as Record<string, unknown>).minute ?? (p.date_fields as Record<string, unknown>).минута) || 0,
          };
          computedMabs = CalendarMath.getAbsoluteMinute(dInput, activeCal);
        } catch {
          computedMabs = null;
        }
      }

      const formattedDate = formatDiegeticDate(computedMabs, p.date_fields);
      const sceneKind = p.kind || 'scene';

      items.push({
        id: `prom-${p.id}`,
        type: 'promise',
        kind: sceneKind,
        title: `${sceneKind === 'scene' ? 'Сцена' : 'Обещание'}: «${p.quote.slice(0, 45)}${p.quote.length > 45 ? '...' : ''}»`,
        subtitle: p.chapter_title
          ? `Глава: ${p.chapter_title}`
          : `Глава #${p.planted_order ?? '?'}`,
        fullText: p.quote, // ПОЛНЫЙ ТЕКСТ СЦЕНЫ
        timeLabel: formattedDate,
        phaseLabel: primaryArc?.phaseLabel || getPhaseLabel(p.arc_phase),
        chapter_id: p.chapter_id || undefined,
        chapter_title: p.chapter_title || undefined,
        chapter_order: p.planted_order,
        paragraph_index: p.paragraph_index,
        block_id: p.block_id || undefined,
        m_abs: computedMabs,
        calendar_id: p.calendar_id,
        date_fields: p.date_fields,
        timeline_event_id: p.timeline_event_id,
        arc_id: primaryArc?.arcId || p.arc_id || undefined,
        arc_title: combinedArcTitle,
        arc_color: primaryArc?.arcColor || p.arc_color || undefined,
        arc_phase: primaryArc?.phase || p.arc_phase || undefined,
        boundArcs,
        allArcIds,
        badge: p.status === 'resolved' ? 'Разрешено' : 'Активно',
        badgeType: p.status === 'resolved' ? 'success' : 'accent',
        description: primaryArc?.phase ? `Фаза арки: ${primaryArc.phase}` : undefined,
      });
    });

    return items;
  });

  // 2. Отфильтрованные элементы с детекцией флэшбеков
  const filteredTimelineItems = computed<JourneyTimelineItem[]>(() => {
    let items = allTimelineItems.value.filter((item) => {
      // Фильтр по типу с учетом kind
      if (filterType.value === 'scenes') {
        if (item.type !== 'promise' || (item.kind && item.kind !== 'scene')) return false;
      } else if (filterType.value === 'promises') {
        if (item.type !== 'promise' || item.kind === 'scene') return false;
      } else if (filterType.value === 'events') {
        if (item.type !== 'event') return false;
      } else if (filterType.value === 'relations') {
        if (item.type !== 'relation_change') return false;
      }

      // Фильтр по арке (с поддержкой нескольких арок на одной сцене)
      if (selectedArcFilter.value !== 'ALL') {
        const itemArcs = item.allArcIds && item.allArcIds.length > 0
          ? item.allArcIds
          : (item.arc_id ? [item.arc_id] : []);

        if (selectedArcFilter.value === 'UNASSIGNED') {
          if (itemArcs.length > 0) return false;
        } else {
          const cleanFilter = selectedArcFilter.value.replace(/^story_arcs:/, '');
          const matches = itemArcs.some((id) => (id || '').replace(/^story_arcs:/, '') === cleanFilter);
          if (!matches) {
            return false;
          }
        }
      }

      return true;
    });

    // Сортировка в зависимости от viewMode
    if (viewMode.value === 'CHRONOLOGY') {
      items = [...items].sort((a, b) => {
        const mAbsA = a.m_abs ?? (a.chapter_order ? a.chapter_order * 1000 : 0);
        const mAbsB = b.m_abs ?? (b.chapter_order ? b.chapter_order * 1000 : 0);
        return mAbsA - mAbsB;
      });
    } else {
      // NARRATIVE или BY_ARCS: Сортировка по порядку глав для читателя
      items = [...items].sort((a, b) => {
        const orderA = a.chapter_order ?? (a.m_abs ? Math.floor(a.m_abs / 1000) : 0);
        const orderB = b.chapter_order ?? (b.m_abs ? Math.floor(b.m_abs / 1000) : 0);
        if (orderA !== orderB) return orderA - orderB;
        return (a.paragraph_index ?? 0) - (b.paragraph_index ?? 0);
      });
    }

    // Детекция флэшбеков и расчет дельты времени (при чтении книги, если время мира пошло вспять)
    let lastSeenMabs: number | null = null;
    return items.map((item) => {
      let isFlashback = false;
      let flashbackDeltaLabel: string | undefined = undefined;

      if (viewMode.value !== 'CHRONOLOGY' && item.m_abs !== undefined && item.m_abs !== null) {
        if (lastSeenMabs !== null && item.m_abs < lastSeenMabs) {
          isFlashback = true;
          const delta = lastSeenMabs - item.m_abs;
          flashbackDeltaLabel = formatFlashbackDelta(delta);
        }
        lastSeenMabs = item.m_abs;
      }

      return {
        ...item,
        isFlashback,
        flashbackDeltaLabel,
      };
    });
  });

  // 3. Группировка по сюжетным аркам (сцены дублируются во все ветви арок, к которым привязаны)
  const arcGroups = computed<ArcGroup[]>(() => {
    const groupsMap = new Map<string, ArcGroup>();

    // Инициализируем зарегистрированные арки проекта
    storyArcsStore.arcs.forEach((arc) => {
      if (arc.id) {
        const cleanKey = arc.id.replace(/^story_arcs:/, '');
        groupsMap.set(cleanKey, {
          arcId: arc.id,
          arcTitle: arc.title,
          arcColor: arc.color || undefined,
          items: [],
        });
      }
    });

    // Специальная группа "Вне арок"
    const unassignedGroup: ArcGroup = {
      arcId: 'UNASSIGNED',
      arcTitle: '🌿 Вне сюжетных арок',
      arcColor: 'var(--text-muted)',
      items: [],
    };

    filteredTimelineItems.value.forEach((item) => {
      const itemArcs = item.allArcIds && item.allArcIds.length > 0
        ? item.allArcIds
        : (item.arc_id ? [item.arc_id] : []);

      if (itemArcs.length === 0) {
        unassignedGroup.items.push(item);
      } else {
        // Добавляем сцену в каждую арку, к которой она привязана
        itemArcs.forEach((arcId) => {
          const cleanArcKey = (arcId || '').replace(/^story_arcs:/, '');
          if (cleanArcKey && groupsMap.has(cleanArcKey)) {
            groupsMap.get(cleanArcKey)!.items.push(item);
          } else if (cleanArcKey) {
            // Арка есть в данных, но не была в сторе
            const boundMatch = item.boundArcs?.find(
              (b) => b.arcId.replace(/^story_arcs:/, '') === cleanArcKey
            );
            groupsMap.set(cleanArcKey, {
              arcId: boundMatch?.arcId || arcId,
              arcTitle: boundMatch?.arcTitle || item.arc_title || 'Сюжетная арка',
              arcColor: boundMatch?.arcColor || item.arc_color || undefined,
              items: [item],
            });
          }
        });
      }
    });

    const result = Array.from(groupsMap.values()).filter((g) => g.items.length > 0);
    if (unassignedGroup.items.length > 0) {
      result.push(unassignedGroup);
    }
    return result;
  });

  // Текущая сущность
  const currentEntity = computed(() => {
    const clean = (currentEntityId.value || '').replace(/^entities:/, '');
    return entitiesList.value.find((e) => (e.id || '').replace(/^entities:/, '') === clean) || null;
  });

  // Переключение персонажа
  const selectEntity = (id: string) => {
    currentEntityId.value = id;
    loadJourney();
  };

  watch(() => initialEntityId, (newId) => {
    if (newId && newId !== currentEntityId.value) {
      currentEntityId.value = newId;
      loadJourney();
    }
  });

  watch(() => projectId, () => {
    loadEntities();
    loadJourney();
  });

  onMounted(async () => {
    await loadEntities();
    await loadJourney();
  });

  return {
    data,
    currentEntityId,
    currentEntity,
    entitiesList,
    isLoading,
    error,
    viewMode,
    selectedArcFilter,
    filterType,
    timelineItems: filteredTimelineItems,
    arcGroups,
    storyArcs: computed(() => storyArcsStore.arcs),
    selectEntity,
    refresh: loadJourney,
  };
}
