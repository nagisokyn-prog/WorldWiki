/**
 * @file usePlanetEditor.ts
 * @description Composable-хук управления UI-состоянием экрана Планеты (Planet View).
 * Бизнес-сохранение делегирует calendarApi, математические расчеты — ядру календаря.
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type {
  PlanetEditorProps,
  PlanetEditorEmits,
  PlanetEditorTab,
  PlanetDto,
  PlanetTimezone,
  PlanetRegion,
  PlanetMoon,
} from './PlanetEditor.model';
import type { PlanetPreset } from './presets/planet.presets';
import {
  toPlanetEntity,
  createDefaultPlanetDto,
  populatePlanetFromEntity,
  calculateSolstices,
  buildEarth24Timezones,
} from './planetEditor.utils';
import { calendarApi } from '@/services/api/calendar.api';
import { useCalendarStore } from '@/stores/calendar.store';

export function usePlanetEditor(
  props: PlanetEditorProps,
  emit: PlanetEditorEmits
) {
  const calendarStore = useCalendarStore();
  const activeTab = ref<PlanetEditorTab>('astrophysics');
  const isSaving = ref(false);
  const errorMessage = ref<string | null>(null);

  // Реактивное состояние редактируемой планеты
  const planet = ref<PlanetDto>(createDefaultPlanetDto(props.planetId));

  function loadPlanetData() {
    const planetsList = calendarStore.getPlanets(props.projectId);
    const found = planetsList.find(
      (p) => String(p.id) === String(props.planetId) ||
             String(p.id).endsWith(String(props.planetId)) ||
             p.name === props.planetId
    );
    if (found) {
      populatePlanetFromEntity(planet.value, found);
    } else {
      planet.value.id = props.planetId || null;
      if (props.planetId && props.planetId !== 'earth') {
        planet.value.name = props.planetId;
      }
    }
  }

  onMounted(() => {
    loadPlanetData();
    const handleRenamed = (e: Event) => {
      const { id, name } = (e as CustomEvent<{ id: string; name: string }>).detail;
      if (props.planetId && (id === props.planetId || String(props.planetId).endsWith(id))) {
        if (planet.value.name !== name) {
          planet.value.name = name;
        }
      }
    };
    document.addEventListener('ww:planet-renamed', handleRenamed as EventListener);
    onUnmounted(() => {
      document.removeEventListener('ww:planet-renamed', handleRenamed as EventListener);
    });
  });

  watch(() => props.planetId, () => {
    loadPlanetData();
  });

  function updateName(newName: string) {
    planet.value.name = newName;
    calendarStore.savePlanet(props.projectId, toPlanetEntity(planet.value, props.projectId));
    emit('update:name', newName);
    emit('update:planet', planet.value);
    document.dispatchEvent(new CustomEvent('ww:planet-renamed', {
      detail: { id: props.planetId || planet.value.id, name: newName },
    }));
  }

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

  function updateOrbitDays(days: number) {
    planet.value.orbit_days = days;
    planet.value.orbit_days_num = Math.round(days * 10000);
    planet.value.orbit_days_den = 10000;
    recalculateAstroPoints();
  }


  function recalculateAstroPoints() {
    planet.value.solstices = calculateSolstices(planet.value.orbit_days);
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
      planet.value.timezones = buildEarth24Timezones();
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
      color: moon?.color || 'var(--color-moon-secondary, var(--color-border-subtle))',
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
        moons: planet.value.moons.map((m) => {
          const clean: Record<string, unknown> = {
            name: m.name,
            orbital_period: m.orbital_period,
            start_phase: m.start_phase,
          };
          if (m.id) clean.id = m.id;
          return clean;
        }),
        timezones: planet.value.timezones,
        regions: planet.value.regions,
        solstices: planet.value.solstices,
      };

      calendarStore.savePlanet(props.projectId, toPlanetEntity(planet.value, props.projectId));
      await calendarApi.savePlanetDirect(
        props.projectId,
        planet.value.id || null,
        planet.value.name,
        payload
      );

      document.dispatchEvent(new CustomEvent('ww:planet-renamed', {
        detail: { id: props.planetId || planet.value.id, name: planet.value.name },
      }));

      emit('save', planet.value);
      emit('update:name', planet.value.name);
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
      calendarStore.deletePlanet(props.projectId, String(planet.value.id || props.planetId));
      await calendarApi.deletePlanetDirect(props.projectId, planet.value.id);
      document.dispatchEvent(new CustomEvent('ww:planet-deleted', {
        detail: { id: props.planetId || planet.value.id },
      }));
      emit('delete', planet.value.id);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      errorMessage.value = `Ошибка удаления планеты: ${err}`;
      console.error('[PlanetEditor]', err);
    }
  }

  const isPresetsModalOpen = ref(false);

  function openPresetsModal() {
    isPresetsModalOpen.value = true;
  }

  function applyPreset(preset: PlanetPreset) {
    const p = preset.data;
    if (p.name) planet.value.name = p.name;
    if (p.icon) planet.value.icon = p.icon;
    if (p.ticks_per_day !== undefined) planet.value.ticks_per_day = p.ticks_per_day;
    if (p.day_hours !== undefined) planet.value.day_hours = p.day_hours;
    if (p.day_minutes !== undefined) planet.value.day_minutes = p.day_minutes;
    if (p.day_seconds !== undefined) planet.value.day_seconds = p.day_seconds;
    if (p.orbit_days !== undefined) planet.value.orbit_days = p.orbit_days;
    if (p.orbit_days_num !== undefined) planet.value.orbit_days_num = p.orbit_days_num;
    if (p.orbit_days_den !== undefined) planet.value.orbit_days_den = p.orbit_days_den;
    if (p.axial_tilt_mdeg !== undefined) planet.value.axial_tilt_mdeg = p.axial_tilt_mdeg;
    if (p.rotation_direction) planet.value.rotation_direction = p.rotation_direction;
    if (p.solstices) planet.value.solstices = { ...p.solstices };
    if (p.timezones) planet.value.timezones = JSON.parse(JSON.stringify(p.timezones));
    if (p.regions) planet.value.regions = JSON.parse(JSON.stringify(p.regions));
    if (p.moons) planet.value.moons = JSON.parse(JSON.stringify(p.moons));

    emit('update:name', planet.value.name);
    emit('update:planet', planet.value);
  }

  return {
    activeTab,
    planet,
    decimalAxialTilt,
    isSaving,
    errorMessage,
    isPresetsModalOpen,
    openPresetsModal,
    applyPreset,
    setTab,
    updateName,
    updateDayTicks,
    updateOrbitDays,
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
