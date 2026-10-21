import { computed, ref } from 'vue';
import type {
  Tab2ErasSyncProps,
  Tab2ErasSyncEmits,
  AnchorEventDto,
  SyncTargetType,
  SyncDirection,
  ExtendedEraDto,
} from './Tab2ErasSync.model';
import type { CalendarMonth, CalendarEra, SyncAnchor, CalendarAnchorEvent } from '@/services/Calendars/calendar.types';

export function useTab2ErasSync(
  props: Tab2ErasSyncProps,
  emit: Tab2ErasSyncEmits
) {
  const isMaster = computed<boolean>(() => {
    return Boolean(props.calendarData?.is_master);
  });

  const syncAnchor = computed<SyncAnchor | undefined>(() => {
    return props.calendarData?.sync_anchor;
  });

  const syncType = computed<SyncTargetType>(() => {
    return (syncAnchor.value?.sync_type as SyncTargetType) || 'event';
  });

  const selectedEventId = ref<string>('ev_1');
  const offsetDirection = ref<SyncDirection>('after');
  const offsetYears = ref<number>(0);
  const targetCalendarId = ref<string>('julian');
  const targetCalendarYear = ref<number>(1);
  const selectedMasterEraIndex = ref<number>(-1);
  const anchorMonth = ref<number>(2); // Март
  const anchorDay = ref<number>(15);

  const eras = computed<ExtendedEraDto[]>(() => {
    const raw = props.calendarData?.эпохи || [];
    return raw as ExtendedEraDto[];
  });

  const masterEras = computed<CalendarEra[]>(() => {
    return props.masterCalendarData?.эпохи || [
      { название: 'Наша эра', год_начала: 1, год_конца: 9999 },
      { название: 'Эра Дракона', год_начала: 800, год_конца: 9999 },
    ];
  });

  const masterMonths = computed<CalendarMonth[]>(() => {
    return props.masterCalendarData?.месяцы || [
      { название: 'Январь', дней: 31 },
      { название: 'Февраль', дней: 28 },
      { название: 'Март', дней: 31 },
      { название: 'Апрель', дней: 30 },
    ];
  });

  const anchorEvents = computed<AnchorEventDto[]>(() => {
    const raw = props.calendarData?.anchor_events;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as AnchorEventDto[];
    }
    return [
      { id: 'ev_1', name: '👑 Коронация Первого Императора', year: 1, month: 2, day: 15 },
      { id: 'ev_2', name: '☄️ Падение Метеорита', year: -312, month: 5, day: 1 },
      { id: 'ev_3', name: '🗡️ Битва Пяти Воинств', year: 2941, month: 10, day: 23 },
    ];
  });

  const currentEvent = computed<AnchorEventDto | undefined>(() => {
    return (
      anchorEvents.value.find((e) => e.id === selectedEventId.value || e.name === selectedEventId.value) ||
      anchorEvents.value[0]
    );
  });

  const syncDescription = computed<string>(() => {
    const mName = masterMonths.value[anchorMonth.value]?.название || 'Марта';
    if (syncType.value === 'event') {
      const evName = currentEvent.value?.name || 'Опорное событие';
      const dirText = offsetYears.value === 0 ? '' : ` (${offsetYears.value} лет ${offsetDirection.value === 'after' ? 'после' : 'до'})`;
      return `Год 1 этого календаря соответствует ${anchorDay.value} ${mName} (Опорное событие: ${evName}${dirText}).`;
    }
    if (syncType.value === 'calendar') {
      return `Синхронизировано с календарем: ${targetCalendarId.value} (Год ${targetCalendarYear.value}).`;
    }
    const eraName = selectedMasterEraIndex.value === -1 ? 'начала Календаря Мира' : masterEras.value[selectedMasterEraIndex.value]?.название || 'эпохи';
    return `Год 1 соответствует ${anchorDay.value} ${mName} от ${eraName} (смещение ${offsetYears.value} лет).`;
  });

  function updateSyncAnchorPatch(patch: Partial<SyncAnchor>) {
    const current = syncAnchor.value || {
      linked_to_master: true,
      sync_type: 'event',
    };
    emit('update', { sync_anchor: { ...current, ...patch } });
  }

  function setSyncType(type: SyncTargetType) {
    updateSyncAnchorPatch({ sync_type: type });
  }

  function updateEras(newEras: ExtendedEraDto[]) {
    emit('update', { эпохи: newEras as unknown as CalendarEra[] });
  }

  function addEra() {
    const list = [...eras.value];
    const prevEnd = list.length > 0 ? (list[list.length - 1].год_конца ?? 1000) : 0;
    list.push({
      название: `Эпоха ${list.length + 1}`,
      год_начала: prevEnd + 1,
      год_конца: prevEnd + 1000,
      суффикс: 'н.э.',
      обратный_отсчет: false,
      has_anniversary: false,
      anniversary_month: 0,
      anniversary_day: 1,
    });
    updateEras(list);
  }

  function removeEra(idx: number) {
    if (eras.value.length <= 1) return;
    const list = eras.value.filter((_, i) => i !== idx);
    updateEras(list);
  }

  function reorderEra(idx: number, dir: -1 | 1) {
    const list = [...eras.value];
    const targetIdx = idx + dir;
    if (targetIdx >= 0 && targetIdx < list.length) {
      const temp = list[idx];
      list[idx] = list[targetIdx];
      list[targetIdx] = temp;
      updateEras(list);
    }
  }

  function updateAnchorEvents(events: AnchorEventDto[]) {
    emit('update', { anchor_events: events as unknown as CalendarAnchorEvent[] });
  }

  function addAnchorEvent(event: AnchorEventDto) {
    const list = [...anchorEvents.value, event];
    updateAnchorEvents(list);
  }

  function removeAnchorEvent(idx: number) {
    const list = anchorEvents.value.filter((_, i) => i !== idx);
    updateAnchorEvents(list);
  }

  function saveCurrentEvent(ev: AnchorEventDto) {
    const list = anchorEvents.value.map((e) => (e.id === ev.id ? { ...ev } : e));
    updateAnchorEvents(list);
  }

  return {
    isMaster,
    syncType,
    selectedEventId,
    offsetDirection,
    offsetYears,
    targetCalendarId,
    targetCalendarYear,
    selectedMasterEraIndex,
    anchorMonth,
    anchorDay,
    eras,
    masterEras,
    masterMonths,
    anchorEvents,
    currentEvent,
    syncDescription,
    setSyncType,
    updateEras,
    addEra,
    removeEra,
    reorderEra,
    updateAnchorEvents,
    addAnchorEvent,
    removeAnchorEvent,
    saveCurrentEvent,
  };
}
