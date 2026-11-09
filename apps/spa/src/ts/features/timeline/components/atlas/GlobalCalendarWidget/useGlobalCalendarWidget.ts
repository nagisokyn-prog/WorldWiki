import { ref, computed, onMounted } from 'vue';
import { useCalendarStore } from '@/stores/calendar.store';
import { CalendarMath } from '@/services/Calendars/useCalendarEngine';

import type { CalendarRecord } from '@/stores/calendar.store';
import type { CalendarData } from '@/services/Calendars/calendar.types';

export function useGlobalCalendarWidget(props: { project: string }) {
  const masterCalendar = ref<CalendarRecord | null>(null);
  const localCalendars = ref<CalendarRecord[]>([]);

  const selectedLocalCal = ref<string | null>(null);
  const isAtlasOpen = ref(false);
  const isLoading = ref(true);

  const currentMasterInput = ref({
    era_index: 0,
    year: 1,
    month: 0,
    day: 1,
    hour: 12,
    minute: 0
  });

  const loadCalendars = async () => {
    isLoading.value = true;
    try {
      const list = await useCalendarStore().getCalendars(props.project);
      masterCalendar.value =
        list.find(
          (c: CalendarRecord) =>
            c.is_master === true ||
            (c.data as Record<string, unknown> | undefined)?.is_master === true ||
            (c.data as Record<string, unknown> | undefined)?.calendar_type === 'master' ||
            (c.data as Record<string, unknown> | undefined)?.название === 'Календарь Мира' ||
            c.name === 'Календарь Мира'
        ) ||
        list[0] ||
        null;
      localCalendars.value = list.filter((c: CalendarRecord) => c.id !== masterCalendar.value?.id);
      if (localCalendars.value.length > 0 && !selectedLocalCal.value) {
        selectedLocalCal.value = localCalendars.value[0].id || null;
      }
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(() => {
    loadCalendars();
  });

  const masterCalendarData = computed<CalendarData | null>(() => {
    if (!masterCalendar.value) return null;
    let d = masterCalendar.value.data as Record<string, unknown> | null;
    if (d && typeof d === 'object' && 'data' in d && typeof d.data === 'object' && d.data !== null) {
      d = d.data as Record<string, unknown>;
    }
    if (!d || (!d.месяцы && (masterCalendar.value as unknown as Record<string, unknown>).месяцы)) {
      d = masterCalendar.value as unknown as Record<string, unknown>;
    }
    return (d as unknown as CalendarData) || null;
  });

  const currentAbsoluteMinute = computed(() => {
    if (!masterCalendarData.value) return 0;
    return CalendarMath.getAbsoluteMinute(currentMasterInput.value, masterCalendarData.value);
  });

  const maxDaysInCurrentMonth = computed(() => {
    if (!masterCalendarData.value) return 31;
    return CalendarMath.getDaysInMonth(
      masterCalendarData.value,
      currentMasterInput.value.year,
      currentMasterInput.value.month
    );
  });

  const maxHoursInDay = computed(() => {
    return masterCalendarData.value?.настройки_времени?.часов_в_сутках || 24;
  });

  const maxMinutesInHour = computed(() => {
    return masterCalendarData.value?.настройки_времени?.минут_в_часе || 60;
  });

  const activeMoons = computed(() => {
    if (!masterCalendarData.value?.moons) return [];
    return CalendarMath.calculateMoonPhases(
      currentAbsoluteMinute.value,
      masterCalendarData.value.moons,
      masterCalendarData.value
    );
  });

  const activeHoliday = computed(() => {
    const master = masterCalendarData.value;
    if (!master) return null;
    return CalendarMath.isHoliday(
      master,
      currentMasterInput.value.year,
      currentMasterInput.value.month,
      currentMasterInput.value.day
    );
  });

  const formattedMasterDate = computed(() => {
    if (!masterCalendarData.value) return '';
    const dateObj = { 
      absolute_minute: currentAbsoluteMinute.value,
      calendar_id: masterCalendar.value?.id || '',
      original_input: currentMasterInput.value
    };
    return CalendarMath.formatDate(masterCalendarData.value, dateObj);
  });

  const formattedLocalDate = computed(() => {
    if (!selectedLocalCal.value) return '';
    const localCal = localCalendars.value.find(c => c.id === selectedLocalCal.value);
    if (!localCal) return '';

    let localData = localCal.data as Record<string, unknown> | null;
    if (localData && typeof localData === 'object' && 'data' in localData && typeof localData.data === 'object' && localData.data !== null) {
      localData = localData.data as Record<string, unknown>;
    }
    if (!localData || (!localData.месяцы && (localCal as unknown as Record<string, unknown>).месяцы)) {
      localData = localCal as unknown as Record<string, unknown>;
    }
    if (!localData || (!localData.месяцы && !localData.название)) return '';
    const typedLocalData = localData as unknown as CalendarData;
    
    // Используем синхронизированную конвертацию с учетом SyncAnchor
    const localInput = CalendarMath.masterMinuteToLocalDate(
      currentAbsoluteMinute.value,
      typedLocalData,
      masterCalendarData.value,
      0
    );
    
    const dateObj = {
      absolute_minute: currentAbsoluteMinute.value,
      calendar_id: localCal.id || '',
      original_input: localInput
    };
    
    return CalendarMath.formatDate(typedLocalData, dateObj);
  });

  const prevDay = () => {
    if (currentMasterInput.value.day > 1) {
      currentMasterInput.value.day--;
    } else {
      if (currentMasterInput.value.month > 0) {
        currentMasterInput.value.month--;
      } else {
        currentMasterInput.value.month = (masterCalendar.value?.data?.месяцы?.length || 1) - 1;
        currentMasterInput.value.year--;
      }
      if (masterCalendar.value?.data) {
        currentMasterInput.value.day = CalendarMath.getDaysInMonth(
          masterCalendar.value.data,
          currentMasterInput.value.year,
          currentMasterInput.value.month
        );
      }
    }
  };

  const nextDay = () => {
    const maxDays = masterCalendar.value?.data ? CalendarMath.getDaysInMonth(
      masterCalendar.value.data,
      currentMasterInput.value.year,
      currentMasterInput.value.month
    ) : 30;

    if (currentMasterInput.value.day < maxDays) {
      currentMasterInput.value.day++;
    } else {
      currentMasterInput.value.day = 1;
      if (currentMasterInput.value.month < (masterCalendar.value?.data?.месяцы?.length || 1) - 1) {
        currentMasterInput.value.month++;
      } else {
        currentMasterInput.value.month = 0;
        currentMasterInput.value.year++;
      }
    }
  };

  const openAtlas = () => { isAtlasOpen.value = true; };
  const closeAtlas = () => { isAtlasOpen.value = false; };

  const isExplainerOpen = ref(false);
  const toggleExplainer = () => { isExplainerOpen.value = !isExplainerOpen.value; };
  const closeExplainer = () => { isExplainerOpen.value = false; };

  const dateExplanation = computed(() => {
    if (!masterCalendarData.value) return null;
    const activeLocal = localCalendars.value.find(c => c.id === selectedLocalCal.value)?.data;
    const targetCal = activeLocal || masterCalendarData.value;
    const allCals = [
      masterCalendarData.value,
      ...(localCalendars.value.map(c => c.data).filter(Boolean) as CalendarData[])
    ];
    return CalendarMath.explainDate(
      currentMasterInput.value,
      targetCal,
      allCals,
      masterCalendarData.value
    );
  });

  const isCopied = ref(false);
  const copySnippet = async () => {
    if (dateExplanation.value?.snippet && navigator?.clipboard) {
      await navigator.clipboard.writeText(dateExplanation.value.snippet);
      isCopied.value = true;
      setTimeout(() => { isCopied.value = false; }, 2000);
    }
  };

  return {
    masterCalendar,
    masterCalendarData,
    localCalendars,
    selectedLocalCal,
    currentMasterInput,
    maxDaysInCurrentMonth,
    maxHoursInDay,
    maxMinutesInHour,
    formattedMasterDate,
    formattedLocalDate,
    activeMoons,
    activeHoliday,
    isAtlasOpen,
    isLoading,
    openAtlas,
    closeAtlas,
    prevDay,
    nextDay,
    isExplainerOpen,
    toggleExplainer,
    closeExplainer,
    dateExplanation,
    isCopied,
    copySnippet,
  };
}
