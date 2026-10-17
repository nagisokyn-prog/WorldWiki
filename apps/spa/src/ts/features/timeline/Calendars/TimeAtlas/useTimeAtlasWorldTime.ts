import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { CalendarMath } from '../../../../services/Calendars/useCalendarEngine';
import type { CalendarData, CalendarDate } from '../../../../services/Calendars/calendar.types';

export function useTimeAtlasWorldTime(
  masterCalendar: ComputedRef<CalendarData | null>,
  currentWorldMinute: Ref<number>,
  getLocalDateForCal: (cal: CalendarData) => CalendarDate['original_input']
) {
  const worldTimezones = computed(() => {
    return masterCalendar.value?.timezones || [];
  });

  const worldRegions = computed(() => {
    return masterCalendar.value?.regions || [];
  });

  const currentWorldMoment = computed(() => {
    const master = masterCalendar.value;
    if (!master) return { day_index: 0, day_fraction: 0 };
    const settings = master.настройки_времени || { часов_в_сутках: 24, минут_в_часе: 60 };
    const dayMins = (settings.часов_в_сутках || 24) * (settings.минут_в_часе || 60);
    const dayIndex = Math.floor(currentWorldMinute.value / dayMins);
    const remMins = ((currentWorldMinute.value % dayMins) + dayMins) % dayMins;
    return {
      day_index: dayIndex,
      day_fraction: dayMins > 0 ? remMins / dayMins : 0
    };
  });

  const worldTimeSnapshot = computed(() => {
    const master = masterCalendar.value;
    if (!master) return [];

    const moment = currentWorldMoment.value;
    const tzs = worldTimezones.value;

    return worldRegions.value.map((region) => {
      const tz = tzs.find(t => t.id === region.timezone_id);
      const offsetHours = tz ? CalendarMath.getTimezoneOffsetForDay(tz, moment.day_index) : 0;

      const localInput = CalendarMath.worldMomentToDate(moment, master, offsetHours);
      const localDateFormatted = CalendarMath.formatDate(master, {
        absolute_minute: currentWorldMinute.value,
        calendar_id: master._id || '',
        original_input: localInput
      });

      const hh = String(localInput.hour ?? 0).padStart(2, '0');
      const mm = String(localInput.minute ?? 0).padStart(2, '0');
      const localTimeStr = `${hh}:${mm}`;

      const sunStatus = CalendarMath.calculateSunForRegion(region, moment, master, tzs);

      return {
        region,
        timezone: tz,
        offsetHours,
        localTimeStr,
        localDateFormatted,
        sunStatus
      };
    });
  });

  const worldTimeSnippet = computed(() => {
    const snapshot = worldTimeSnapshot.value;
    if (snapshot.length === 0) {
      return 'В мире ещё не настроены географические регионы. Добавьте их в Настройках Календаря Мира.';
    }

    const parts = snapshot.map((item) => {
      return `${item.region.name} (${item.localTimeStr}, ${item.sunStatus.phase_label})`;
    });

    const master = masterCalendar.value;
    const masterDate = master ? getLocalDateForCal(master) : null;
    const masterDateStr = master && masterDate ? `${masterDate.day} ${master.месяцы?.[masterDate.month]?.название || ''} ${masterDate.year} г.` : '';

    return `В то время как шёл ${masterDateStr}, мир жил в разных ритмах: ${parts.join('; ')}.`;
  });

  const isWorldTimeCopied = ref(false);
  const copyWorldTimeSnippet = async () => {
    if (worldTimeSnippet.value && navigator?.clipboard) {
      await navigator.clipboard.writeText(worldTimeSnippet.value);
      isWorldTimeCopied.value = true;
      setTimeout(() => { isWorldTimeCopied.value = false; }, 2000);
    }
  };

  const masterCalendarName = computed(() => masterCalendar.value?.название || 'Календарь Мира');
  const masterTimeSettings = computed(() => {
    const m = masterCalendar.value;
    return m?.настройки_времени || (m as { time_settings?: { часов_в_сутках?: number; минут_в_часе?: number } })?.time_settings;
  });
  const maxHours = computed(() => masterTimeSettings.value?.часов_в_сутках || 24);
  const maxMinutes = computed(() => masterTimeSettings.value?.минут_в_часе || 60);

  const worldHour = computed({
    get: () => {
      const hoursInDay = maxHours.value;
      const minsInHour = maxMinutes.value;
      const dayMins = hoursInDay * minsInHour;
      const remMins = ((currentWorldMinute.value % dayMins) + dayMins) % dayMins;
      return Math.floor(remMins / minsInHour);
    },
    set: (newHour: number) => {
      const hoursInDay = maxHours.value;
      const minsInHour = maxMinutes.value;
      const dayMins = hoursInDay * minsInHour;
      const dayIndex = Math.floor(currentWorldMinute.value / dayMins);
      const curMin = (((currentWorldMinute.value % dayMins) + dayMins) % dayMins) % minsInHour;
      const hClamped = Math.max(0, Math.min(hoursInDay - 1, newHour));
      currentWorldMinute.value = dayIndex * dayMins + hClamped * minsInHour + curMin;
    }
  });

  const worldMinute = computed({
    get: () => {
      const hoursInDay = maxHours.value;
      const minsInHour = maxMinutes.value;
      const dayMins = hoursInDay * minsInHour;
      const remMins = ((currentWorldMinute.value % dayMins) + dayMins) % dayMins;
      return remMins % minsInHour;
    },
    set: (newMin: number) => {
      const hoursInDay = maxHours.value;
      const minsInHour = maxMinutes.value;
      const dayMins = hoursInDay * minsInHour;
      const dayIndex = Math.floor(currentWorldMinute.value / dayMins);
      const curHour = Math.floor((((currentWorldMinute.value % dayMins) + dayMins) % dayMins) / minsInHour);
      const mClamped = Math.max(0, Math.min(minsInHour - 1, newMin));
      currentWorldMinute.value = dayIndex * dayMins + curHour * minsInHour + mClamped;
    }
  });

  return {
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
  };
}
