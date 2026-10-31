import { ref, computed, shallowRef } from 'vue';
import { CALENDAR_PRESETS, type CalendarPreset } from '../presets';
import type { CalendarPresetsModalProps, CalendarPresetsModalEmits, CategoryFilter } from './CalendarPresetsModal.model';

export function useCalendarPresetsModal(
  _props: CalendarPresetsModalProps,
  emit: CalendarPresetsModalEmits
) {
  const searchQuery = ref('');
  const activeCategory = ref<CategoryFilter>('all');
  const selectedPreset = shallowRef<CalendarPreset | null>(null);
  const confirmApplyVisible = ref(false);

  const filteredPresets = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    const cat = activeCategory.value;

    return CALENDAR_PRESETS.filter((preset) => {
      const matchCat = cat === 'all' || preset.category === cat;
      if (!matchCat) return false;

      if (!q) return true;

      return (
        preset.name.toLowerCase().includes(q) ||
        preset.description.toLowerCase().includes(q) ||
        preset.authorOrLore.toLowerCase().includes(q)
      );
    });
  });

  function selectCategory(cat: CategoryFilter) {
    activeCategory.value = cat;
  }

  function promptApplyPreset(preset: CalendarPreset) {
    selectedPreset.value = preset;
    confirmApplyVisible.value = true;
  }

  function confirmApply() {
    if (selectedPreset.value) {
      emit('select-preset', selectedPreset.value);
      confirmApplyVisible.value = false;
      close();
    }
  }

  function cancelApply() {
    confirmApplyVisible.value = false;
    selectedPreset.value = null;
  }

  function close() {
    emit('update:modelValue', false);
  }

  return {
    searchQuery,
    activeCategory,
    selectedPreset,
    confirmApplyVisible,
    filteredPresets,
    selectCategory,
    promptApplyPreset,
    confirmApply,
    cancelApply,
    close,
  };
}

