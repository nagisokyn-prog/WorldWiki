import { ref, computed, watch, onMounted } from 'vue';
import * as api from '@/services/api.client';
import { useCalendarStore } from '@/stores/calendar.store';
import type { CalendarData, WorldTimezone } from '@/services/Calendars/calendar.types';
import {
  LOCATION_SCALE_LABELS,
  resolveLocationGeography,
  computeLocationLocalTime,
  type GeographyEntityRecord,
} from '@/services/Geography/locationHierarchy';
import type {
  LocationAstronomyWidgetProps,
  LocationAstronomyWidgetEmits,
} from './LocationAstronomyWidget.model';

export function useLocationAstronomyWidget(
  props: LocationAstronomyWidgetProps,
  emit?: LocationAstronomyWidgetEmits
) {
  const calendarStore = useCalendarStore();
  const allEntities = ref<GeographyEntityRecord[]>([]);
  const masterCalendar = ref<CalendarData | null>(null);
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);

  const previewWorldHour = ref<number>(12);
  const previewDayIndex = ref<number>(172); // Летний день по умолчанию для наглядности

  const loadContextData = async () => {
    if (!props.project) return;
    isLoading.value = true;
    loadError.value = null;
    try {
      const [locations, states, calendars] = await Promise.all([
        api.getEntities(props.project, 'location'),
        api.getEntities(props.project, 'state'),
        calendarStore.getCalendars(props.project),
      ]);

      const combined: GeographyEntityRecord[] = [
        ...((locations as unknown as GeographyEntityRecord[]) || []),
        ...((states as unknown as GeographyEntityRecord[]) || []),
      ];
      allEntities.value = combined;

      if (calendars && calendars.length > 0) {
        const masterRec =
          calendars.find((c) => c.is_master) ||
          calendars.find((c) => c.is_default) ||
          calendars[0];
        masterCalendar.value = (masterRec?.data as CalendarData) || null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      loadError.value = msg;
      console.error('[useLocationAstronomyWidget] Error loading geography context:', err);
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(() => {
    loadContextData();
  });

  watch(
    () => props.project,
    (newProj) => {
      if (newProj) loadContextData();
    }
  );

  const availableTimezones = computed<WorldTimezone[]>(() => {
    if (masterCalendar.value?.timezones && masterCalendar.value.timezones.length > 0) {
      return masterCalendar.value.timezones;
    }
    if (props.project) {
      const planets = calendarStore.getPlanets(props.project);
      const planetId =
        (props.formData['планета_id'] as string) || masterCalendar.value?.planet_id;
      const matchedPlanet = planetId
        ? planets.find((p) => p.id === planetId || p.name === planetId)
        : planets[0];
      if (matchedPlanet?.timezones?.length) {
        return matchedPlanet.timezones;
      }
    }
    return [];
  });

  const resolvedGeo = computed(() => {
    const currentRecord: GeographyEntityRecord = {
      ...props.formData,
      id: props.entityId || (props.formData.id as string) || 'current_location',
      entity_type: 'location',
    };
    return resolveLocationGeography(
      currentRecord,
      allEntities.value,
      availableTimezones.value,
      previewDayIndex.value
    );
  });

  const maxHoursPerDay = computed(() => {
    return masterCalendar.value?.настройки_времени?.часов_в_сутках || 24;
  });

  const previewAbsoluteMinute = computed(() => {
    const settings = masterCalendar.value?.настройки_времени || {
      часов_в_сутках: 24,
      минут_в_часе: 60,
    };
    const minsPerHour = settings.минут_в_часе || 60;
    const dayMins = (settings.часов_в_сутках || 24) * minsPerHour;
    return previewDayIndex.value * dayMins + previewWorldHour.value * minsPerHour;
  });

  const timeInfo = computed(() => {
    return computeLocationLocalTime(
      previewAbsoluteMinute.value,
      resolvedGeo.value,
      masterCalendar.value,
      availableTimezones.value
    );
  });

  const scaleLabel = computed(() => {
    return (
      LOCATION_SCALE_LABELS[resolvedGeo.value.scale] ||
      LOCATION_SCALE_LABELS.settlement
    );
  });

  const formattedOffset = computed(() => {
    const off = resolvedGeo.value.offsetHours;
    const sign = off >= 0 ? '+' : '';
    return `UTC${sign}${off}`;
  });

  const coordinatesLabel = computed(() => {
    const lat = resolvedGeo.value.latitude;
    const lon = resolvedGeo.value.longitude;
    if (lat === null && lon === null) {
      return 'Не заданы (экватор / нулевой меридиан по умолчанию)';
    }
    const latStr =
      lat !== null ? `${Math.abs(lat)}° ${lat >= 0 ? 'с.ш.' : 'ю.ш.'}` : '0° ш.';
    const lonStr =
      lon !== null ? `${Math.abs(lon)}° ${lon >= 0 ? 'в.д.' : 'з.д.'}` : '0° д.';
    return `${latStr}, ${lonStr}`;
  });

  const selectTimezonePreset = (tzVal: string) => {
    if (emit) {
      emit('apply-timezone', tzVal);
    }
  };

  const setSeasonDayPreset = (dayIdx: number) => {
    previewDayIndex.value = dayIdx;
  };

  return {
    isLoading,
    loadError,
    previewWorldHour,
    previewDayIndex,
    maxHoursPerDay,
    availableTimezones,
    resolvedGeo,
    timeInfo,
    scaleLabel,
    formattedOffset,
    coordinatesLabel,
    selectTimezonePreset,
    setSeasonDayPreset,
    refreshContext: loadContextData,
  };
}

