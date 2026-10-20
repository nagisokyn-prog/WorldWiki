/**
 * @file usePlanetEditor.ts
 * @description Composable-хук управления UI-состоянием экрана Планеты (Planet View).
 * Бизнес-сохранение делегирует calendarApi, математические расчеты — ядру календаря.
 */

import { ref, computed } from 'vue';
import type {
  PlanetEditorProps,
  PlanetEditorEmits,
  PlanetEditorTab,
  PlanetDto,
  PlanetTimezone,
  PlanetRegion,
  PlanetMoon,
} from './PlanetEditor.model';
import { calendarApi } from '@/services/api/calendar.api';

export function usePlanetEditor(
  props: PlanetEditorProps,
  emit: PlanetEditorEmits
) {
  const activeTab = ref<PlanetEditorTab>('astrophysics');
  const isSaving = ref(false);
  const errorMessage = ref<string | null>(null);

  // Реактивное состояние редактируемой планеты
  const planet = ref<PlanetDto>({
    id: props.planetId || null,
    name: 'Земля (Earth)',
    icon: '🪐',
    ticks_per_day: 86400,
    day_hours: 24,
    day_minutes: 0,
    day_seconds: 0,
    orbit_days_num: 3652422,
    orbit_days_den: 10000,
    orbit_days: 365.2422,
    axial_tilt_mdeg: 23440,
    rotation_direction: 'direct',
    solstices: {
      winter: 355.0,
      spring: 80.0,
      summer: 172.0,
      autumn: 266.0,
    },
    timezones: [
      { name: 'Столичный меридиан', code: 'UTC+0', offset_hours: 0.0, dst_rule: 'eu' },
      { name: 'Восточный рубеж', code: 'UTC+3', offset_hours: 3.0, dst_rule: 'none' },
      { name: 'Дальний Архипелаг', code: 'UTC+8', offset_hours: 8.0, dst_rule: 'none' },
      { name: 'Западные Земли', code: 'UTC-5', offset_hours: -5.0, dst_rule: 'us' },
    ],
    regions: [
      {
        name: 'Столица Империи',
        timezone_code: 'UTC+0',
        latitude: 55.75,
        longitude: 37.61,
        max_day_hours: '17ч 34м',
        min_day_hours: '7ч 12м',
      },
      {
        name: 'Южная Гавань',
        timezone_code: 'UTC+3',
        latitude: 30.2,
        longitude: 60.0,
        max_day_hours: '14ч 10м',
        min_day_hours: '10ч 20м',
      },
    ],
    moons: [
      { name: 'Луна (Селена)', orbital_period: 29.53, start_phase: 0.5, color: '#e2e8f0' },
    ],
  });

  const decimalAxialTilt = computed({
    get: () => planet.value.axial_tilt_mdeg / 1000,
    set: (val: number) => {
      planet.value.axial_tilt_mdeg = Math.round(val * 1000);
    },
  });

  function setTab(tab: PlanetEditorTab) {
    activeTab.value = tab;
  }

  function updateDayTicks() {
    const hours = Number(planet.value.day_hours) || 0;
    const minutes = Number(planet.value.day_minutes) || 0;
    const seconds = Number(planet.value.day_seconds) || 0;
    planet.value.ticks_per_day = hours * 3600 + minutes * 60 + seconds;
  }

  function updateOrbitFromFraction() {
    if (planet.value.orbit_days_den > 0) {
      planet.value.orbit_days =
        Number((planet.value.orbit_days_num / planet.value.orbit_days_den).toFixed(6));
      recalculateAstroPoints();
    }
  }

  function recalculateAstroPoints() {
    const total = planet.value.orbit_days;
    planet.value.solstices = {
      spring: Number((total * 0.219).toFixed(1)),
      summer: Number((total * 0.471).toFixed(1)),
      autumn: Number((total * 0.728).toFixed(1)),
      winter: Number((total * 0.972).toFixed(1)),
    };
  }

  // Часовые пояса
  function addTimezone(tz?: Partial<PlanetTimezone>) {
    planet.value.timezones.push({
      name: tz?.name || `Пояс ${planet.value.timezones.length + 1}`,
      code: tz?.code || `UTC+${planet.value.timezones.length}`,
      offset_hours: tz?.offset_hours ?? 0,
      dst_rule: tz?.dst_rule || 'none',
    });
  }

  function removeTimezone(index: number) {
    if (index >= 0 && index < planet.value.timezones.length) {
      planet.value.timezones.splice(index, 1);
    }
  }

  function applyTimezonePreset(preset: 'earth24' | 'single') {
    if (preset === 'single') {
      planet.value.timezones = [
        { name: 'Нулевой меридиан', code: 'UTC+0', offset_hours: 0, dst_rule: 'none' },
      ];
    } else if (preset === 'earth24') {
      const list: PlanetTimezone[] = [];
      for (let h = -12; h <= 12; h++) {
        const sign = h >= 0 ? '+' : '';
        list.push({
          name: h === 0 ? 'Гринвич / Меридиан' : `Пояс ${sign}${h}`,
          code: `UTC${sign}${h}`,
          offset_hours: h,
          dst_rule: 'none',
        });
      }
      planet.value.timezones = list;
    }
  }

  // Регионы
  function addRegion(reg?: Partial<PlanetRegion>) {
    planet.value.regions.push({
      name: reg?.name || `Регион ${planet.value.regions.length + 1}`,
      timezone_code: reg?.timezone_code || 'UTC+0',
      latitude: reg?.latitude ?? 0,
      longitude: reg?.longitude ?? 0,
      max_day_hours: reg?.max_day_hours || '12ч 00м',
      min_day_hours: reg?.min_day_hours || '12ч 00м',
    });
  }

  function removeRegion(index: number) {
    if (index >= 0 && index < planet.value.regions.length) {
      planet.value.regions.splice(index, 1);
    }
  }

  // Спутники (Луны)
  function addMoon(moon?: Partial<PlanetMoon>) {
    planet.value.moons.push({
      name: moon?.name || `Луна ${planet.value.moons.length + 1}`,
      orbital_period: moon?.orbital_period ?? 28.0,
      start_phase: moon?.start_phase ?? 0.0,
      color: moon?.color || '#cbd5e1',
    });
  }

  function removeMoon(index: number) {
    if (index >= 0 && index < planet.value.moons.length) {
      planet.value.moons.splice(index, 1);
    }
  }

  // Сохранение планеты через API бэкенда
  async function savePlanet() {
    isSaving.value = true;
    errorMessage.value = null;
    try {
      const payload: Record<string, unknown> = {
        name: planet.value.name,
        ticks_per_day: planet.value.ticks_per_day,
        axial_tilt_mdeg: planet.value.axial_tilt_mdeg,
        orbit_days_num: planet.value.orbit_days_num,
        orbit_days_den: planet.value.orbit_days_den,
        rotation_direction: planet.value.rotation_direction,
        moons: planet.value.moons,
        timezones: planet.value.timezones,
        regions: planet.value.regions,
        solstices: planet.value.solstices,
      };

      await calendarApi.savePlanetDirect(
        props.projectId,
        planet.value.id || null,
        planet.value.name,
        payload
      );

      emit('save', planet.value);
      emit('update:planet', planet.value);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      errorMessage.value = `Ошибка сохранения планеты: ${err}`;
      console.error('[PlanetEditor]', err);
    } finally {
      isSaving.value = false;
    }
  }

  async function deletePlanet() {
    if (!planet.value.id) return;
    if (!confirm(`Удалить планету "${planet.value.name}" и все связанные с ней данные?`)) {
      return;
    }

    try {
      await calendarApi.deletePlanetDirect(planet.value.id);
      emit('delete', planet.value.id);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      errorMessage.value = `Ошибка удаления планеты: ${err}`;
      console.error('[PlanetEditor]', err);
    }
  }

  return {
    activeTab,
    planet,
    decimalAxialTilt,
    isSaving,
    errorMessage,
    setTab,
    updateDayTicks,
    updateOrbitFromFraction,
    recalculateAstroPoints,
    addTimezone,
    removeTimezone,
    applyTimezonePreset,
    addRegion,
    removeRegion,
    addMoon,
    removeMoon,
    savePlanet,
    deletePlanet,
  };
}
