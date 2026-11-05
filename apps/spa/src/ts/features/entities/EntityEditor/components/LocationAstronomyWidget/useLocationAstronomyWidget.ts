import { ref, computed, watch, onMounted } from 'vue';
import * as api from '@/services/api.client';
import { useCalendarStore } from '@/stores/calendar.store';
import type { CalendarData, WorldTimezone } from '@/services/Calendars/calendar.types';
import {
  LOCATION_SCALE_LABELS,
  BUILDING_SUBTYPE_LABELS,
  resolveLocationGeography,
  computeLocationLocalTime,
  cleanEntityId,
  type GeographyEntityRecord,
  type ResolvedLocationGeography,
} from '@/services/Geography/locationHierarchy';
import type {
  LocationAstronomyWidgetProps,
  LocationAstronomyWidgetEmits,
  LocationSeasonChip,
} from './LocationAstronomyWidget.model';
import {
  computeAvailableSeasons,
  formatCoordinatesLabel,
  formatTimezoneChipLabel,
} from './locationAstronomyWidget.utils';

export function useLocationAstronomyWidget(
  props: LocationAstronomyWidgetProps,
  emit?: LocationAstronomyWidgetEmits
) {
  const calendarStore = useCalendarStore();
  const allEntities = ref<GeographyEntityRecord[]>([]);
  const allCalendars = ref<Map<string, CalendarData>>(new Map());
  const masterCalendar = ref<CalendarData | null>(null);
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);

  const previewWorldHour = ref<number>(12);
  const previewDayIndex = ref<number>(172);

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

      const calMap = new Map<string, CalendarData>();
      if (calendars && calendars.length > 0) {
        for (const c of calendars) {
          const cData = (c.data as CalendarData) || (c as unknown as CalendarData);
          if (c.id) {
            calMap.set(c.id, cData);
            calMap.set(cleanEntityId(c.id), cData);
          }
          if (c.name) calMap.set(c.name.toLowerCase(), cData);
        }
        const masterRec =
          calendars.find((c) => c.is_master) ||
          calendars.find((c) => c.is_default) ||
          calendars[0];
        masterCalendar.value = (masterRec?.data as CalendarData) || null;
      }
      allCalendars.value = calMap;
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

  const allTimezonesList = computed<WorldTimezone[]>(() => {
    const list: WorldTimezone[] = [];
    if (masterCalendar.value?.timezones) list.push(...masterCalendar.value.timezones);
    for (const cal of allCalendars.value.values()) {
      if (cal.timezones) list.push(...cal.timezones);
    }
    if (props.project) {
      const planets = calendarStore.getPlanets(props.project);
      for (const p of planets) {
        if (p.timezones) list.push(...p.timezones);
      }
    }
    return list;
  });

  const resolvedGeo = computed<ResolvedLocationGeography>(() => {
    const defaultPlanetId =
      (props.formData['планета_id'] as string) ||
      masterCalendar.value?.planet_id ||
      calendarStore.getPlanets(props.project)[0]?.id ||
      null;
    const currentRecord: GeographyEntityRecord = {
      ...props.formData,
      id: props.entityId || (props.formData.id as string) || 'current_location',
      entity_type: 'location',
    };
    if (!currentRecord['планета_id'] && defaultPlanetId) {
      currentRecord['планета_id'] = defaultPlanetId;
    }
    return resolveLocationGeography(
      currentRecord,
      allEntities.value,
      allTimezonesList.value,
      previewDayIndex.value
    );
  });

  const activeCalendar = computed<CalendarData | null>(() => {
    const calId =
      resolvedGeo.value.officialCalendarId ||
      (props.formData['календарь_id'] as string) ||
      (props.formData['календарь'] as string) ||
      (props.formData['официальный_календарь'] as string);

    if (calId) {
      const clean = cleanEntityId(calId);
      const found = allCalendars.value.get(clean) || allCalendars.value.get(String(calId).toLowerCase());
      if (found) return found;
    }
    return masterCalendar.value;
  });

  const availableTimezones = computed<WorldTimezone[]>(() => {
    const cal = activeCalendar.value || masterCalendar.value;
    if (cal?.timezones && cal.timezones.length > 0) {
      return cal.timezones;
    }
    if (props.project) {
      const planets = calendarStore.getPlanets(props.project);
      const planetId =
        (props.formData['планета_id'] as string) || cal?.planet_id;
      const matchedPlanet = planetId
        ? planets.find((p) => p.id === planetId || p.name === planetId)
        : planets[0];
      if (matchedPlanet?.timezones?.length) {
        return matchedPlanet.timezones;
      }
    }
    return [];
  });

  const availableSeasons = computed<LocationSeasonChip[]>(() =>
    computeAvailableSeasons(activeCalendar.value, masterCalendar.value)
  );

  const maxHoursPerDay = computed(() => {
    const cal = activeCalendar.value || masterCalendar.value;
    return cal?.настройки_времени?.часов_в_сутках || 24;
  });

  const previewAbsoluteMinute = computed(() => {
    const cal = activeCalendar.value || masterCalendar.value;
    const settings = cal?.настройки_времени || {
      часов_в_сутках: 24,
      минут_в_часе: 60,
    };
    const minsPerHour = settings.минут_в_часе || 60;
    const dayMins = (settings.часов_в_сутках || 24) * minsPerHour;
    return previewDayIndex.value * dayMins + previewWorldHour.value * minsPerHour;
  });

  const timeInfo = computed(() => {
    const cal = activeCalendar.value || masterCalendar.value;
    return computeLocationLocalTime(
      previewAbsoluteMinute.value,
      resolvedGeo.value,
      cal,
      availableTimezones.value
    );
  });

  const scaleLabel = computed(() => {
    const base =
      LOCATION_SCALE_LABELS[resolvedGeo.value.scale] ||
      LOCATION_SCALE_LABELS.settlement;
    if (resolvedGeo.value.scale === 'building' && resolvedGeo.value.buildingSubtype) {
      const sub = BUILDING_SUBTYPE_LABELS[resolvedGeo.value.buildingSubtype];
      if (sub) return `🏰 Здание (${sub})`;
    }
    return base;
  });

  const formattedOffset = computed(() => {
    const off = resolvedGeo.value.offsetHours;
    const sign = off >= 0 ? '+' : '';
    return `UTC${sign}${off}`;
  });

  const coordinatesLabel = computed(() =>
    formatCoordinatesLabel(resolvedGeo.value.latitude, resolvedGeo.value.longitude)
  );

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
    availableSeasons,
    selectTimezonePreset,
    setSeasonDayPreset,
    formatTimezoneChipLabel,
    refreshContext: loadContextData,
  };
}

