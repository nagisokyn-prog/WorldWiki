import { ref, computed, watch, onMounted } from 'vue';
import { useCalendarStore } from '../../../../stores/calendar.store';
import { CalendarMath } from '../../../../services/Calendars/calendar.math';
import type { CalendarRecord } from '../../../../stores/calendar.store';
import type { CalendarData, CalendarDate, MoonPhaseResult } from '../../../../services/Calendars/calendar.types';

export interface CalendarColumnState {
  calendarId: string;
  input: CalendarDate['original_input'];
}

export function useTimeAtlasModal(props: { project: string; isOpen: boolean }, emit: (e: 'close') => void) {
  const activeTab = ref<'converter' | 'matrix' | 'snippets'>('converter');
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
    return masterCalendarRecord.value ? (masterCalendarRecord.value.data as CalendarData) : null;
  });

  // Текущая мировая абсолютная минута (единый якорь времени в Атласе)
  const currentWorldMinute = ref(0);

  // Выбранные календари для мульти-колоночного компаратора
  const selectedCalIds = ref<string[]>([]);

  // Для матричного режима (сетки)
  const matrixBaseCalId = ref<string>('');
  const matrixCompareCalId = ref<string>('');
  const matrixYear = ref(1);
  const matrixMonth = ref(0);

  const loadCalendars = async () => {
    if (!props.project) return;
    loading.value = true;
    try {
      const list = await useCalendarStore().getCalendars(props.project);
      const sorted = (list || []).slice().sort((a, b) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0));
      allCalendars.value = sorted;

      const master = sorted.find(c => c.is_master) || sorted[0];
      if (master && selectedCalIds.value.length === 0) {
        selectedCalIds.value = sorted.map(c => c.id!).filter(Boolean);
        matrixBaseCalId.value = sorted.find(c => !c.is_master)?.id || master.id || '';
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

  const getCalendarById = (id: string): CalendarData | null => {
    const rec = allCalendars.value.find(c => c.id === id);
    return rec ? (rec.data as CalendarData) : null;
  };

  // Получить локальную дату для календаря от текущей мировой минуты
  const getLocalDateForCal = (cal: CalendarData) => {
    return CalendarMath.masterMinuteToLocalDate(currentWorldMinute.value, cal, masterCalendar.value, 0);
  };

  // Установить мировую минуту из локальной даты одного из календарей
  const updateFromLocalDate = (cal: CalendarData, localDate: CalendarDate['original_input']) => {
    currentWorldMinute.value = CalendarMath.localDateToMasterMinute(localDate, cal, masterCalendar.value);
  };

  // Информация о праздниках и лунах для даты календаря
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

  // Детектор совпадений (культурные коллизии и природные маркеры)
  const activeAlignments = computed(() => {
    const events: Array<{ calName: string; text: string; type: 'holiday' | 'moon' | 'sun' }> = [];
    
    // Световой день планеты
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
      const cal = calRec.data as CalendarData;
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

  // Генератор литературных формулировок
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
      const cal = calRec.data as CalendarData;
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

  // Логика матрицы месяца
  const matrixBaseCal = computed(() => getCalendarById(matrixBaseCalId.value));
  const matrixCompareCal = computed(() => getCalendarById(matrixCompareCalId.value));

  const matrixDaysCount = computed(() => {
    if (!matrixBaseCal.value) return 30;
    return CalendarMath.getDaysInMonth(matrixBaseCal.value, matrixYear.value, matrixMonth.value);
  });

  const matrixGridDays = computed(() => {
    const base = matrixBaseCal.value;
    const comp = matrixCompareCal.value;
    if (!base) return [];

    const days = [];
    for (let d = 1; d <= matrixDaysCount.value; d++) {
      const baseInput: CalendarDate['original_input'] = {
        era_index: 0,
        year: matrixYear.value,
        month: matrixMonth.value,
        day: d,
        hour: 12,
        minute: 0
      };

      const baseMin = CalendarMath.localDateToMasterMinute(baseInput, base, masterCalendar.value);
      const baseMeta = getDateMeta(base, baseInput);

      let compDateStr = '';
      let compHoliday: string | null = null;

      if (comp) {
        const compDate = CalendarMath.masterMinuteToLocalDate(baseMin, comp, masterCalendar.value, 0);
        const compMeta = getDateMeta(comp, compDate);
        compHoliday = compMeta.holiday;
        const compMonthName = comp.месяцы?.[compDate.month]?.название?.slice(0, 3) || `${compDate.month + 1}`;
        compDateStr = `${compDate.day} ${compMonthName}`;
      }

      days.push({
        day: d,
        baseInput,
        baseMin,
        baseMeta,
        compDateStr,
        compHoliday,
        isCurrent: Math.floor(baseMin / 1440) === Math.floor(currentWorldMinute.value / 1440)
      });
    }
    return days;
  });

  const selectMatrixDay = (baseMin: number) => {
    currentWorldMinute.value = baseMin;
  };

  const prevMatrixMonth = () => {
    if (!matrixBaseCal.value) return;
    if (matrixMonth.value > 0) {
      matrixMonth.value--;
    } else {
      matrixMonth.value = (matrixBaseCal.value.месяцы?.length || 1) - 1;
      matrixYear.value--;
    }
  };

  const nextMatrixMonth = () => {
    if (!matrixBaseCal.value) return;
    if (matrixMonth.value < (matrixBaseCal.value.месяцы?.length || 1) - 1) {
      matrixMonth.value++;
    } else {
      matrixMonth.value = 0;
      matrixYear.value++;
    }
  };

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
    masterCalendarRecord,
    localCalendarRecords,
    currentWorldMinute,
    selectedCalIds,
    matrixBaseCalId,
    matrixCompareCalId,
    matrixYear,
    matrixMonth,
    matrixBaseCal,
    matrixCompareCal,
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
