import { ref, computed, onMounted } from 'vue';
import { useCalendarStore } from '../../../../stores/calendar.store';
import { CalendarMath } from '../../../../services/Calendars/calendar.math';

import type { CalendarRecord } from '../../../../stores/calendar.store';

export function useGlobalCalendarWidget(props: { project: string }) {
  const masterCalendar = ref<CalendarRecord | null>(null);
  const localCalendars = ref<CalendarRecord[]>([]);

  const selectedLocalCal = ref<string | null>(null);
  const isAtlasOpen = ref(false);

  const currentMasterInput = ref({
    era_index: 0,
    year: 1,
    month: 0,
    day: 1,
    hour: 12,
    minute: 0
  });

  const loadCalendars = async () => {
    const list = await useCalendarStore().getCalendars(props.project);
    masterCalendar.value = list.find(c => c.is_master) || null;
    localCalendars.value = list.filter(c => !c.is_master);
    if (localCalendars.value.length > 0 && !selectedLocalCal.value) {
      selectedLocalCal.value = localCalendars.value[0].id || null;
    }
  };

  onMounted(() => {
    loadCalendars();
  });

  const currentAbsoluteMinute = computed(() => {
    if (!masterCalendar.value?.data) return 0;
    return CalendarMath.getAbsoluteMinute(currentMasterInput.value, masterCalendar.value.data);
  });

  const maxDaysInCurrentMonth = computed(() => {
    if (!masterCalendar.value?.data) return 31;
    return CalendarMath.getDaysInMonth(
      masterCalendar.value.data,
      currentMasterInput.value.year,
      currentMasterInput.value.month
    );
  });

  const maxHoursInDay = computed(() => {
    return masterCalendar.value?.data?.настройки_времени?.часов_в_сутках || 24;
  });

  const maxMinutesInHour = computed(() => {
    return masterCalendar.value?.data?.настройки_времени?.минут_в_часе || 60;
  });

  const activeMoons = computed(() => {
    if (!masterCalendar.value?.data?.moons) return [];
    return CalendarMath.calculateMoonPhases(
      currentAbsoluteMinute.value,
      masterCalendar.value.data.moons,
      masterCalendar.value.data
    );
  });

  const activeHoliday = computed(() => {
    const master = masterCalendar.value?.data;
    if (!master) return null;
    return CalendarMath.isHoliday(
      master,
      currentMasterInput.value.year,
      currentMasterInput.value.month,
      currentMasterInput.value.day
    );
  });

  const formattedMasterDate = computed(() => {
    if (!masterCalendar.value?.data) return '';
    const dateObj = { 
      absolute_minute: currentAbsoluteMinute.value,
      calendar_id: masterCalendar.value.id || '',
      original_input: currentMasterInput.value
    };
    return CalendarMath.formatDate(masterCalendar.value.data, dateObj);
  });

  const formattedLocalDate = computed(() => {
    if (!selectedLocalCal.value) return '';
    const localCal = localCalendars.value.find(c => c.id === selectedLocalCal.value);
    if (!localCal?.data) return '';
    
    // Используем синхронизированную конвертацию с учетом SyncAnchor
    const localInput = CalendarMath.masterMinuteToLocalDate(
      currentAbsoluteMinute.value,
      localCal.data,
      masterCalendar.value?.data,
      0
    );
    
    const dateObj = {
      absolute_minute: currentAbsoluteMinute.value,
      calendar_id: localCal.id || '',
      original_input: localInput
    };
    
    return CalendarMath.formatDate(localCal.data, dateObj);
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
    if (!masterCalendar.value?.data) return null;
    const allCals = [
      masterCalendar.value.data,
      ...(localCalendars.value.map(c => c.data).filter(Boolean) as any[])
    ];
    const activeLocal = localCalendars.value.find(c => c.id === selectedLocalCal.value)?.data;
    return CalendarMath.explainDate(
      currentMasterInput.value,
      activeLocal || masterCalendar.value.data,
      allCals,
      masterCalendar.value.data
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
