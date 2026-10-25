import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { CalendarMath } from '../../../../services/Calendars/useCalendarEngine';
import type { CalendarData, CalendarDate, WorldRegion, WorldTimezone, RegionSunStatus } from '../../../../services/Calendars/calendar.types';
import { useCalendarStore } from '../../../../stores/calendar.store';

export function useTimeAtlasWorldTime(
  masterCalendar: ComputedRef<CalendarData | null>,
  currentWorldMinute: Ref<number>,
  getLocalDateForCal: (cal: CalendarData) => CalendarDate['original_input'],
  projectId?: ComputedRef<string> | string | Ref<string>
) {
  const calendarStore = useCalendarStore();

  const currentPlanet = computed(() => {
    const proj = typeof projectId === 'object' && projectId !== null && 'value' in projectId
      ? (projectId as Ref<string>).value
      : (typeof projectId === 'string' ? projectId : '');
    if (!proj) return null;
    const planets = calendarStore.getPlanets(proj);
    const planetId = masterCalendar.value?.planet_id;
    if (planetId) {
      const found = planets.find(
        (p) => String(p.id) === String(planetId) ||
               String(p.id).endsWith(String(planetId)) ||
               p.name === planetId
      );
      if (found) return found;
    }
    return planets[0] || null;
  });

  const worldTimezones = computed<WorldTimezone[]>(() => {
    if (masterCalendar.value?.timezones && masterCalendar.value.timezones.length > 0) {
      return masterCalendar.value.timezones;
    }
    if (currentPlanet.value?.timezones && currentPlanet.value.timezones.length > 0) {
      return currentPlanet.value.timezones.map((tz, idx) => ({
        id: tz.id || `tz_${(tz as { code?: string }).code || idx}`,
        name: tz.name,
        code: (tz as { code?: string }).code || tz.name,
        base_offset_hours: tz.base_offset_hours ?? (tz as { offset_hours?: number }).offset_hours ?? 0,
        historical_rules: tz.historical_rules
      }));
    }
    return [];
  });

  const worldRegions = computed<WorldRegion[]>(() => {
    if (masterCalendar.value?.regions && masterCalendar.value.regions.length > 0) {
      return masterCalendar.value.regions;
    }
    if (currentPlanet.value?.regions && currentPlanet.value.regions.length > 0) {
      return currentPlanet.value.regions.map((r, idx) => {
        const raw = r as unknown as Record<string, unknown>;
        return {
          id: r.id || `reg_${idx}`,
          name: r.name,
          timezone_id: r.timezone_id || (raw.timezone_code as string) || '',
          latitude: r.latitude ?? (Number(raw.latitude) || 0),
          longitude: r.longitude ?? (Number(raw.longitude) || 0),
          summer_day_hours: r.summer_day_hours ?? (parseFloat(String(raw.max_day_hours || '12')) || 12),
          winter_day_hours: r.winter_day_hours ?? (parseFloat(String(raw.min_day_hours || '12')) || 12),
        };
      });
    }
    return [];
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
    const regions = worldRegions.value;

    const items: Array<{
      region: WorldRegion;
      timezone?: WorldTimezone;
      offsetHours: number;
      localTimeStr: string;
      localDateFormatted: string;
      sunStatus: RegionSunStatus;
    }> = [];

    const coveredTzKeys = new Set<string>();

    // 1. Сначала добавляем все явно настроенные пользователем регионы
    for (const region of regions) {
      const tz = tzs.find(t =>
        t.id === region.timezone_id ||
        (t.code && t.code === region.timezone_id) ||
        (region.timezone_id === 'tz_utc' && (t.code === 'UTC' || t.code === 'UTC+0' || t.base_offset_hours === 0)) ||
        (region.timezone_id === 'tz_msk' && (t.code === 'MSK' || t.code === 'UTC+3' || t.base_offset_hours === 3))
      );
      if (tz) {
        if (tz.id) coveredTzKeys.add(tz.id);
        if (tz.code) coveredTzKeys.add(tz.code);
      }

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

      const sunStatus = CalendarMath.calculateSunForRegion(region, moment, master, tzs, offsetHours);

      items.push({
        region,
        timezone: tz,
        offsetHours,
        localTimeStr,
        localDateFormatted,
        sunStatus
      });
    }

    // 2. Для всех настроенных часовых поясов планеты, у которых еще нет отдельного города/региона, добавляем поясную карточку
    for (const tz of tzs) {
      if (coveredTzKeys.has(tz.id) || (tz.code && coveredTzKeys.has(tz.code))) {
        continue;
      }
      const offsetHours = CalendarMath.getTimezoneOffsetForDay(tz, moment.day_index);
      const localInput = CalendarMath.worldMomentToDate(moment, master, offsetHours);
      const localDateFormatted = CalendarMath.formatDate(master, {
        absolute_minute: currentWorldMinute.value,
        calendar_id: master._id || '',
        original_input: localInput
      });

      const hh = String(localInput.hour ?? 0).padStart(2, '0');
      const mm = String(localInput.minute ?? 0).padStart(2, '0');
      const localTimeStr = `${hh}:${mm}`;

      const sign = offsetHours >= 0 ? '+' : '';
      const synthRegion: WorldRegion = {
        id: `reg_auto_${tz.id || tz.code}`,
        name: tz.name || tz.code || `Пояс ${sign}${offsetHours}`,
        timezone_id: tz.id,
        latitude: 0,
        longitude: offsetHours * 15,
      };

      const sunStatus = CalendarMath.calculateSunForRegion(synthRegion, moment, master, tzs, offsetHours);

      items.push({
        region: synthRegion,
        timezone: tz,
        offsetHours,
        localTimeStr,
        localDateFormatted,
        sunStatus
      });
    }

    // Сортируем все карточки по часовому смещению (от запада к востоку: -12ч ... +12ч)
    return items.sort((a, b) => a.offsetHours - b.offsetHours);
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
