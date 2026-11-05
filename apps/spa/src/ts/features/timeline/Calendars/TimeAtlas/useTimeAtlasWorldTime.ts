import { ref, computed, watch, type ComputedRef, type Ref } from 'vue';
import * as api from '../../../../services/api.client';
import type {
  CalendarData,
  CalendarDate,
  WorldRegion,
  WorldTimezone,
} from '../../../../services/Calendars/calendar.types';
import type { GeographyEntityRecord } from '../../../../services/Geography/locationHierarchy';
import { useCalendarStore } from '../../../../stores/calendar.store';
import type { WorldSliceFilter, WorldTimeSnapshotItem } from './tabs/TimeAtlasWorldTab.model';
import { buildWorldTimeSnapshot } from './timeAtlasWorldTime.utils';

export function useTimeAtlasWorldTime(
  masterCalendar: ComputedRef<CalendarData | null>,
  currentWorldMinute: Ref<number>,
  getLocalDateForCal: (cal: CalendarData) => CalendarDate['original_input'],
  projectId?: ComputedRef<string> | string | Ref<string>
) {
  const calendarStore = useCalendarStore();
  const worldSliceFilter = ref<WorldSliceFilter>('all');
  const projectEntities = ref<GeographyEntityRecord[]>([]);

  const resolvedProjectId = computed(() => {
    if (typeof projectId === 'object' && projectId !== null && 'value' in projectId) {
      return (projectId as Ref<string>).value || '';
    }
    return typeof projectId === 'string' ? projectId : '';
  });

  const loadWorldGeographyEntities = async () => {
    const proj = resolvedProjectId.value;
    if (!proj) return;
    try {
      const [locations, states] = await Promise.all([
        api.getEntities(proj, 'location'),
        api.getEntities(proj, 'state'),
      ]);
      projectEntities.value = [
        ...((locations as unknown as GeographyEntityRecord[]) || []),
        ...((states as unknown as GeographyEntityRecord[]) || []),
      ];
    } catch (err) {
      console.error('[useTimeAtlasWorldTime] Error loading project locations/states:', err);
    }
  };

  watch(
    resolvedProjectId,
    (proj) => {
      if (proj) void loadWorldGeographyEntities();
    },
    { immediate: true }
  );

  const currentPlanet = computed(() => {
    const proj = resolvedProjectId.value;
    if (!proj) return null;
    const planets = calendarStore.getPlanets(proj);
    const planetId = masterCalendar.value?.planet_id;
    if (planetId) {
      const found = planets.find(
        (p) =>
          String(p.id) === String(planetId) ||
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
        historical_rules: tz.historical_rules,
      }));
    }
    return [];
  });

  const worldRegions = computed<WorldRegion[]>(() => {
    if (masterCalendar.value?.regions && masterCalendar.value.regions.length > 0) {
      return masterCalendar.value.regions;
    }
    if (masterCalendar.value?.timezones && masterCalendar.value.timezones.length > 0 && !masterCalendar.value.planet_id) {
      return masterCalendar.value.regions || [];
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
    return { day_index: dayIndex, day_fraction: dayMins > 0 ? remMins / dayMins : 0 };
  });

  const worldTimeSnapshot = computed<WorldTimeSnapshotItem[]>(() =>
    buildWorldTimeSnapshot({
      master: masterCalendar.value,
      currentWorldMinute: currentWorldMinute.value,
      moment: currentWorldMoment.value,
      tzs: worldTimezones.value,
      regions: worldRegions.value,
      projectEntities: projectEntities.value,
      filter: worldSliceFilter.value,
    })
  );

  const worldTimeSnippet = computed(() => {
    const snapshot = worldTimeSnapshot.value;
    if (snapshot.length === 0) {
      return 'В мире ещё не настроены географические регионы. Добавьте их в Настройках Календаря Мира или в карточках локаций.';
    }
    const parts = snapshot.map((item) => `${item.region.name} (${item.localTimeStr}, ${item.sunStatus.phase_label})`);
    const master = masterCalendar.value;
    const masterDate = master ? getLocalDateForCal(master) : null;
    const masterDateStr =
      master && masterDate ? `${masterDate.day} ${master.месяцы?.[masterDate.month]?.название || ''} ${masterDate.year} г.` : '';
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

  const openLocationEntity = (entityId: string) => {
    if (!entityId || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('ww:open-floating-entity', { detail: { type: 'location', id: entityId } }));
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
      const dayMins = maxHours.value * maxMinutes.value;
      const remMins = ((currentWorldMinute.value % dayMins) + dayMins) % dayMins;
      return Math.floor(remMins / maxMinutes.value);
    },
    set: (newHour: number) => {
      const dayMins = maxHours.value * maxMinutes.value;
      const dayIndex = Math.floor(currentWorldMinute.value / dayMins);
      const curMin = (((currentWorldMinute.value % dayMins) + dayMins) % dayMins) % maxMinutes.value;
      const hClamped = Math.max(0, Math.min(maxHours.value - 1, newHour));
      currentWorldMinute.value = dayIndex * dayMins + hClamped * maxMinutes.value + curMin;
    },
  });

  const worldMinute = computed({
    get: () => {
      const dayMins = maxHours.value * maxMinutes.value;
      const remMins = ((currentWorldMinute.value % dayMins) + dayMins) % dayMins;
      return remMins % maxMinutes.value;
    },
    set: (newMin: number) => {
      const dayMins = maxHours.value * maxMinutes.value;
      const dayIndex = Math.floor(currentWorldMinute.value / dayMins);
      const curHour = Math.floor((((currentWorldMinute.value % dayMins) + dayMins) % dayMins) / maxMinutes.value);
      const mClamped = Math.max(0, Math.min(maxMinutes.value - 1, newMin));
      currentWorldMinute.value = dayIndex * dayMins + curHour * maxMinutes.value + mClamped;
    },
  });

  return {
    worldSliceFilter,
    projectEntities,
    loadWorldGeographyEntities,
    openLocationEntity,
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
    worldMinute,
  };
}
