/**
 * @file usePlanetEditor.ts
 * @description Composable-хук управления UI-состоянием экрана Планеты (Planet View).
 * Бизнес-сохранение делегирует calendarApi, математические расчеты — ядру календаря.
 */

import { ref, computed, onMounted, onUnmounted, onBeforeUnmount, watch } from 'vue';
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
} from './planetEditor.utils';
import {
  persistPlanetSave,
  persistPlanetDelete,
  applyPlanetPresetData,
  addPlanetTimezone,
  removePlanetTimezone,
  applyPlanetTimezonePreset,
  addPlanetRegion,
  removePlanetRegion,
  applyPlanetRegionsPreset,
  addPlanetMoon,
  removePlanetMoon,
} from './planetPersistence';
import { useCalendarStore } from '@/stores/calendar.store';

export function usePlanetEditor(
  props: PlanetEditorProps,
  emit: PlanetEditorEmits
) {
  const calendarStore = useCalendarStore();
  const activeTab = ref<PlanetEditorTab>('astrophysics');
  const isSaving = ref(false), errorMessage = ref<string | null>(null);

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
    const handleTriggerSave = (e: Event) => {
      const custom = e as CustomEvent<{ id?: string }>;
      if (!custom.detail?.id || custom.detail.id === props.planetId || String(planet.value.id).endsWith(custom.detail.id)) {
        void savePlanet();
      }
    };
    document.addEventListener('ww:planet-renamed', handleRenamed as EventListener);
    document.addEventListener('ww:trigger-planet-save', handleTriggerSave as EventListener);
    onUnmounted(() => {
      document.removeEventListener('ww:planet-renamed', handleRenamed as EventListener);
      document.removeEventListener('ww:trigger-planet-save', handleTriggerSave as EventListener);
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


  function syncStorage() {
    calendarStore.savePlanetToStorage(props.projectId, toPlanetEntity(planet.value, props.projectId));
  }

  onBeforeUnmount(() => {
    syncStorage();
  });

  function recalculateAstroPoints() {
    planet.value.solstices = calculateSolstices(planet.value.orbit_days);
  }

  // Часовые пояса
  function addTimezone(tz?: Partial<PlanetTimezone>) {
    addPlanetTimezone(planet.value, tz);
    syncStorage();
    emit('update:planet', planet.value);
  }

  function removeTimezone(index: number) {
    removePlanetTimezone(planet.value, index);
    syncStorage();
    emit('update:planet', planet.value);
  }

  function applyTimezonePreset(preset: 'earth24' | 'single') {
    applyPlanetTimezonePreset(planet.value, preset);
    syncStorage();
    emit('update:planet', planet.value);
  }

  // Регионы
  function addRegion(reg?: Partial<PlanetRegion>) {
    addPlanetRegion(planet.value, reg);
    syncStorage();
    emit('update:planet', planet.value);
  }

  function removeRegion(index: number) {
    removePlanetRegion(planet.value, index);
    syncStorage();
    emit('update:planet', planet.value);
  }

  function applyRegionsPreset(preset: 'earth' | 'fantasy') {
    applyPlanetRegionsPreset(planet.value, preset);
    syncStorage();
    emit('update:planet', planet.value);
  }

  // Спутники (Луны)
  function addMoon(moon?: Partial<PlanetMoon>) {
    addPlanetMoon(planet.value, moon);
  }

  function removeMoon(index: number) {
    removePlanetMoon(planet.value, index);
  }

  // Сохранение планеты через API бэкенда
  async function savePlanet() {
    isSaving.value = true;
    errorMessage.value = null;
    try {
      await persistPlanetSave(planet.value, props.projectId, calendarStore);
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
      await persistPlanetDelete(planet.value.id, props.projectId, calendarStore);
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
  const openPresetsModal = () => { isPresetsModalOpen.value = true; };

  function applyPreset(preset: PlanetPreset) {
    applyPlanetPresetData(planet.value, preset, updateDayTicks);
    syncStorage();
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
    applyRegionsPreset,
    addRegion,
    removeRegion,
    addMoon,
    removeMoon,
    savePlanet,
    deletePlanet,
  };
}
