import { ref, computed, watch } from 'vue';
import { useCalendarStore } from '../../../../stores/calendar.store';
import { CalendarMath } from '../../../../services/Calendars/useCalendarEngine';
import type { CalendarRecord } from '../../../../stores/calendar.store';
import type { CalendarData, CalendarDate, MoonPhaseResult } from '../../../../services/Calendars/calendar.types';
import { useTimeAtlasMatrix } from './useTimeAtlasMatrix';
import { useTimeAtlasWorldTime } from './useTimeAtlasWorldTime';

export interface CalendarColumnState {
  calendarId: string;
  input: CalendarDate['original_input'];
}

export function extractCalendarData(rec: CalendarRecord | null | undefined): CalendarData | null {
  if (!rec) return null;
  if (rec.data && typeof rec.data === 'object' && Object.keys(rec.data).length > 0) {
    return {
      ...rec.data,
      _id: rec.id || rec.data._id,
      название: rec.data.название || rec.name || 'Календарь'
    } as CalendarData;
  }
  if ('дни_в_неделе' in rec || 'месяцы' in rec || 'эпохи' in rec) {
    return {
      ...(rec as unknown as CalendarData),
      _id: rec.id,
      название: (rec as unknown as CalendarData).название || rec.name || 'Календарь'
    };
  }
  return null;
}

export function useTimeAtlasModal(props: { project: string; isOpen: boolean }, _emit?: (e: 'close') => void) {
  const activeTab = ref<'converter' | 'matrix' | 'world_time' | 'snippets'>('converter');
  const allCalendars = ref<CalendarRecord[]>([]);
  const loading = ref(false);

  // Мастер-календарь проекта
  const masterCalendarRecord = computed<CalendarRecord | null>(() => {
    return allCalendars.value.find(c => c.is_master) || allCalendars.value[0] || null;
  });

  const localCalendarRecords = computed<CalendarRecord[]>(() => {
    return allCalendars.value.filter(c => !c.is_master);
  });

  const masterCalendar = computed<CalendarData | null>(() => {
    return extractCalendarData(masterCalendarRecord.value);
  });

  // Текущая мировая абсолютная минута (единый якорь времени в Атласе)
  const currentWorldMinute = ref(0);

  // Выбранные календари для мульти-колоночного компаратора
  const selectedCalIds = ref<string[]>([]);

  const getCalendarById = (id: string): CalendarData | null => {
    const rec = allCalendars.value.find(c => c.id === id);
    return extractCalendarData(rec);
  };

  const getLocalDateForCal = (cal: CalendarData) => {
    return CalendarMath.masterMinuteToLocalDate(currentWorldMinute.value, cal, masterCalendar.value, 0);
  };

  const updateFromLocalDate = (cal: CalendarData, localDate: CalendarDate['original_input']) => {
    currentWorldMinute.value = CalendarMath.localDateToMasterMinute(localDate, cal, masterCalendar.value);
  };

  const getDateMeta = (cal: CalendarData, date: CalendarDate['original_input']) => {
    const season = CalendarMath.getSeasonForDate(cal, date.year, date.month);
    let holiday: string | null = null;
    if (cal.праздники) {
      for (const h of cal.праздники) {
        const sm = h.дата_начала.месяц, sd = h.дата_начала.день;
        const em = h.дата_конца?.месяц ?? sm, ed = h.дата_конца?.день ?? sd;
        if (date.month >= sm && date.month <= em) {
          if (date.month === sm && date.month === em) {
            if (date.day >= sd && date.day <= ed) { holiday = h.название; break; }
          } else if (date.month === sm) {
            if (date.day >= sd) { holiday = h.название; break; }
          } else if (date.month === em) {
            if (date.day <= ed) { holiday = h.название; break; }
          } else {
            holiday = h.название; break;
          }
        }
      }
    }

    const absMin = CalendarMath.getAbsoluteMinute(date, cal);
    const moons: MoonPhaseResult[] = CalendarMath.calculateMoonPhases(absMin, cal.moons || [], cal);

    return { season, holiday, moons };
  };

  const {
    matrixBaseCalId,
    matrixCompareCalId,
    matrixEra,
    matrixYear,
    matrixMonth,
    matrixBaseCal,
    matrixCompareCal,
    matrixDaysCount,
    matrixGridDays,
    selectMatrixDay,
    prevMatrixMonth,
    nextMatrixMonth
  } = useTimeAtlasMatrix(getCalendarById, masterCalendar, currentWorldMinute, getDateMeta);

  const {
    worldTimezones,
    worldRegions,
    currentWorldMoment,
    worldTimeSnapshot,
    worldTimeSnippet,
    isWorldTimeCopied,
    copyWorldTimeSnippet,
    masterCalendarName,
    maxHours,
    maxMinutes,
    worldHour,
    worldMinute
  } = useTimeAtlasWorldTime(masterCalendar, currentWorldMinute, getLocalDateForCal);

  const loadCalendars = async () => {
    if (!props.project) return;
    loading.value = true;
    try {
      const list: CalendarRecord[] = await useCalendarStore().getCalendars(props.project);
      const sorted = (list || []).slice().sort((a: CalendarRecord, b: CalendarRecord) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0));
      allCalendars.value = sorted;

      const master = sorted.find((c: CalendarRecord) => c.is_master) || sorted[0];
      if (master && selectedCalIds.value.length === 0) {
        selectedCalIds.value = sorted.map((c: CalendarRecord) => c.id!).filter(Boolean);
        matrixBaseCalId.value = sorted.find((c: CalendarRecord) => !c.is_master)?.id || master.id || '';
        matrixCompareCalId.value = master.id || '';
      }
    } finally {
      loading.value = false;
    }
  };

  watch(() => props.isOpen, (open) => {
    if (open) {
      loadCalendars();
    }
  }, { immediate: true });

  const activeAlignments = computed(() => {
    const events: Array<{ calName: string; text: string; type: 'holiday' | 'moon' | 'sun' }> = [];
    const master = masterCalendar.value;
    if (master) {
      const daylight = CalendarMath.calculateDaylight(currentWorldMinute.value, master);
      const daylightInfo = CalendarMath.formatDaylightLiterary(daylight);
      if (daylightInfo) {
        events.push({
          calName: 'Солнце',
          text: `${daylightInfo.duration} (${daylightInfo.sunrise}, ${daylightInfo.sunset})`,
          type: 'sun'
        });
      }
    }

    for (const calRec of allCalendars.value) {
      const cal = extractCalendarData(calRec);
      if (!cal) continue;
      const date = getLocalDateForCal(cal);
      const meta = getDateMeta(cal, date);
      if (meta.holiday) {
        events.push({ calName: cal.название, text: `Праздник: ${meta.holiday}`, type: 'holiday' });
      }
      for (const m of meta.moons) {
        if (m.phase < 0.06 || Math.abs(m.phase - 0.5) < 0.06) {
          events.push({ calName: cal.название, text: `${m.emoji} ${m.moon.name}: ${m.name}`, type: 'moon' });
        }
      }
    }
    return events;
  });

  const snippetFormats = computed(() => {
    const items: Array<{ title: string; text: string }> = [];
    const master = masterCalendar.value;
    const masterDate = master ? getLocalDateForCal(master) : null;
    const masterStr = master && masterDate ? CalendarMath.formatDate(master, {
      absolute_minute: currentWorldMinute.value,
      calendar_id: master._id || '',
      original_input: masterDate
    }) : '';

    for (const calRec of allCalendars.value) {
      const cal = extractCalendarData(calRec);
      if (!cal) continue;
      const localDate = getLocalDateForCal(cal);
      const localStr = CalendarMath.formatDate(cal, {
        absolute_minute: currentWorldMinute.value,
        calendar_id: calRec.id || '',
        original_input: localDate
      });

      items.push({
        title: `Календарь: ${cal.название}`,
        text: localStr
      });

      if (!cal.is_master && masterStr) {
        items.push({
          title: `Двойная датировка (${cal.название} + Календарь Мира)`,
          text: `${localStr} (по летоисчислению Мира — ${masterStr})`
        });
      }
    }
    return items;
  });

  const copiedIdx = ref<number | null>(null);
  const copySnippet = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    copiedIdx.value = idx;
    setTimeout(() => {
      if (copiedIdx.value === idx) copiedIdx.value = null;
    }, 2000);
  };

  return {
    activeTab,
    allCalendars,
    loading,
    masterCalendar,
    masterCalendarName,
    maxHours,
    maxMinutes,
    masterCalendarRecord,
    localCalendarRecords,
    currentWorldMinute,
    currentWorldMoment,
    worldTimezones,
    worldRegions,
    worldTimeSnapshot,
    worldTimeSnippet,
    worldHour,
    worldMinute,
    isWorldTimeCopied,
    copyWorldTimeSnippet,
    selectedCalIds,
    matrixBaseCalId,
    matrixCompareCalId,
    matrixEra,
    matrixYear,
    matrixMonth,
    matrixBaseCal,
    matrixCompareCal,
    matrixDaysCount,
    matrixGridDays,
    activeAlignments,
    snippetFormats,
    copiedIdx,
    getCalendarById,
    getLocalDateForCal,
    updateFromLocalDate,
    getDateMeta,
    selectMatrixDay,
    prevMatrixMonth,
    nextMatrixMonth,
    copySnippet
  };
}
