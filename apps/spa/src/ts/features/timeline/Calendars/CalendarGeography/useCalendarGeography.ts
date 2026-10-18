/**
 * @file useCalendarGeography.ts
 * @description Composable для мультивыбора географических регионов, городов и часовых поясов планеты.
 */

import { ref, computed } from 'vue';
import type { CalendarGeographyProps, CalendarGeographyEmits } from './CalendarGeography.model';
import type { WorldRegion, WorldTimezone } from '../../../../services/Calendars/calendar.types';

export function useCalendarGeography(props: CalendarGeographyProps, emit?: CalendarGeographyEmits) {
  const isCollapsed = ref(false);

  // Список доступных регионов планеты
  const availableRegions = computed<WorldRegion[]>(() => {
    return props.planet?.regions || [];
  });

  // Список доступных часовых поясов планеты
  const availableTimezones = computed<WorldTimezone[]>(() => {
    return props.planet?.timezones || [];
  });

  // Выбранные ID регионов
  const selectedRegionIds = computed<string[]>({
    get: () => props.modelValue.region_ids || [],
    set: (ids) => {
      emit?.('update:modelValue', {
        ...props.modelValue,
        region_ids: ids
      });
    }
  });

  // Выбранные ID часовых поясов
  const selectedTimezoneIds = computed<string[]>({
    get: () => props.modelValue.timezone_ids || [],
    set: (ids) => {
      emit?.('update:modelValue', {
        ...props.modelValue,
        timezone_ids: ids
      });
    }
  });

  // Объекты выбранных регионов для отображения чипов
  const selectedRegions = computed<WorldRegion[]>(() => {
    const ids = new Set(selectedRegionIds.value);
    return availableRegions.value.filter(r => ids.has(r.id));
  });

  // Доступные для добавления регионы (еще не выбранные)
  const unselectedRegions = computed<WorldRegion[]>(() => {
    const ids = new Set(selectedRegionIds.value);
    return availableRegions.value.filter(r => !ids.has(r.id));
  });

  // Объекты выбранных часовых поясов для отображения чипов
  const selectedTimezones = computed<WorldTimezone[]>(() => {
    const ids = new Set(selectedTimezoneIds.value);
    return availableTimezones.value.filter(t => ids.has(t.id));
  });

  // Доступные для добавления часовые пояса
  const unselectedTimezones = computed<WorldTimezone[]>(() => {
    const ids = new Set(selectedTimezoneIds.value);
    return availableTimezones.value.filter(t => !ids.has(t.id));
  });

  const addRegion = (regId: string) => {
    if (!regId) return;
    if (!selectedRegionIds.value.includes(regId)) {
      selectedRegionIds.value = [...selectedRegionIds.value, regId];
    }
  };

  const removeRegion = (regId: string) => {
    selectedRegionIds.value = selectedRegionIds.value.filter(id => id !== regId);
  };

  const addTimezone = (tzId: string) => {
    if (!tzId) return;
    if (!selectedTimezoneIds.value.includes(tzId)) {
      selectedTimezoneIds.value = [...selectedTimezoneIds.value, tzId];
    }
  };

  const removeTimezone = (tzId: string) => {
    selectedTimezoneIds.value = selectedTimezoneIds.value.filter(id => id !== tzId);
  };

  return {
    isCollapsed,
    availableRegions,
    availableTimezones,
    selectedRegionIds,
    selectedTimezoneIds,
    selectedRegions,
    unselectedRegions,
    selectedTimezones,
    unselectedTimezones,
    addRegion,
    removeRegion,
    addTimezone,
    removeTimezone
  };
}
