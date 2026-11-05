/**
 * @file usePlanetPresetsModal.ts
 * @description Логика выбора, фильтрации и применения пресетов планет
 */
import { ref, computed } from 'vue';
import { PLANET_PRESETS, type PlanetPreset } from '@/features/timeline/components/planets/PlanetEditor/presets/planet.presets';
import type { PlanetPresetsModalProps, PlanetPresetsModalEmits } from './PlanetPresetsModal.model';

export function usePlanetPresetsModal(
  props: PlanetPresetsModalProps,
  emit: PlanetPresetsModalEmits
) {
  const searchQuery = ref('');
  const activeTag = ref<string>('all');
  const selectedPreset = ref<PlanetPreset | null>(null);
  const confirmApplyVisible = ref(false);

  const availableTags = computed(() => {
    const set = new Set<string>();
    for (const p of PLANET_PRESETS) {
      if (p.tag) set.add(p.tag);
    }
    return ['all', ...Array.from(set)];
  });

  const filteredPresets = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    return PLANET_PRESETS.filter((p) => {
      const matchTag = activeTag.value === 'all' || p.tag === activeTag.value;
      const matchQuery =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tag.toLowerCase().includes(query);
      return matchTag && matchQuery;
    });
  });

  const selectTag = (tag: string) => {
    activeTag.value = tag;
  };

  const promptApplyPreset = (preset: PlanetPreset) => {
    selectedPreset.value = preset;
    confirmApplyVisible.value = true;
  };

  const confirmApply = () => {
    if (selectedPreset.value) {
      emit('select-preset', selectedPreset.value);
      confirmApplyVisible.value = false;
      emit('update:modelValue', false);
    }
  };

  const cancelApply = () => {
    confirmApplyVisible.value = false;
    selectedPreset.value = null;
  };

  const close = () => {
    confirmApplyVisible.value = false;
    emit('update:modelValue', false);
  };

  return {
    searchQuery,
    activeTag,
    availableTags,
    selectedPreset,
    confirmApplyVisible,
    filteredPresets,
    selectTag,
    promptApplyPreset,
    confirmApply,
    cancelApply,
    close,
  };
}

