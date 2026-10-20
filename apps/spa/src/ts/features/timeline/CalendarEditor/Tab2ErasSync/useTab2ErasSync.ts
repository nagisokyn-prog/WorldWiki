import { computed } from 'vue';
import type { Tab2ErasSyncProps, Tab2ErasSyncEmits, AnchorEventDto } from './Tab2ErasSync.model';
import type { CalendarEra, SyncAnchorDate } from '@/services/Calendars/calendar.types';
import { CalendarEngine } from '@/services/Calendars/useCalendarEngine';

export function useTab2ErasSync(
  props: Tab2ErasSyncProps,
  emit: Tab2ErasSyncEmits
) {
  const isMaster = computed<boolean>(() => {
    return Boolean(props.calendarData?.is_master);
  });

  const eras = computed<CalendarEra[]>(() => {
    return props.calendarData?.эпохи || [];
  });

  const anchorEvents = computed<AnchorEventDto[]>(() => {
    const raw = props.calendarData?.anchor_events;
    if (Array.isArray(raw)) {
      return raw as AnchorEventDto[];
    }
    return [];
  });

  // Расчет культурного сдвига (Delta offset)
  const culturalOffsetDelta = computed<number>(() => {
    return CalendarEngine.getAnchorOffset(props.calendarData, props.masterCalendarData);
  });

  const offsetDescription = computed<string>(() => {
    return CalendarEngine.formatAnchorOffsetDescription(props.calendarData, props.masterCalendarData);
  });

  function updateEras(newEras: CalendarEra[]) {
    emit('update', { эпохи: newEras });
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
    });
    updateEras(list);
  }

  function removeEra(idx: number) {
    if (eras.value.length <= 1) return;
    const list = eras.value.filter((_, i) => i !== idx);
    updateEras(list);
  }

  function updateAnchorEvents(events: AnchorEventDto[]) {
    emit('update', { anchor_events: events as any });
  }

  function addAnchorEvent() {
    const list = [...anchorEvents.value];
    list.push({
      name: `Историческая веха ${list.length + 1}`,
      year: 1000,
      month: 0,
      day: 1,
      description: '',
    });
    updateAnchorEvents(list);
  }

  function removeAnchorEvent(idx: number) {
    const list = anchorEvents.value.filter((_, i) => i !== idx);
    updateAnchorEvents(list);
  }

  function toggleMasterStatus(val: boolean) {
    emit('update', { is_master: val });
  }

  return {
    isMaster,
    eras,
    anchorEvents,
    culturalOffsetDelta,
    offsetDescription,
    updateEras,
    addEra,
    removeEra,
    updateAnchorEvents,
    addAnchorEvent,
    removeAnchorEvent,
    toggleMasterStatus,
  };
}
