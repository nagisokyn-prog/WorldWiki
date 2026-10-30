import { describe, it, expect, vi } from 'vitest';
import { useCalendarPresetsModal } from './useCalendarPresetsModal';
import { CALENDAR_PRESETS } from '../presets';

describe('useCalendarPresetsModal', () => {
  it('loads all 10 presets and initializes with all category', () => {
    const emit = vi.fn();
    const modal = useCalendarPresetsModal({ modelValue: true }, emit);

    expect(modal.filteredPresets.value.length).toBe(10);
    expect(modal.activeCategory.value).toBe('all');
  });

  it('filters presets by category', () => {
    const emit = vi.fn();
    const modal = useCalendarPresetsModal({ modelValue: true }, emit);

    modal.selectCategory('fantasy');
    expect(modal.filteredPresets.value.length).toBe(3);
    modal.filteredPresets.value.forEach((p) => {
      expect(p.category).toBe('fantasy');
    });

    modal.selectCategory('real_world');
    expect(modal.filteredPresets.value.length).toBe(7);
  });

  it('filters presets by search query in Russian', () => {
    const emit = vi.fn();
    const modal = useCalendarPresetsModal({ modelValue: true }, emit);

    modal.searchQuery.value = 'Россия';
    expect(modal.filteredPresets.value.length).toBe(2);

    modal.searchQuery.value = 'Толкин';
    expect(modal.filteredPresets.value.length).toBe(1);
    expect(modal.filteredPresets.value[0].id).toBe('shire_tolkien');
  });

  it('contains no Latin in month names for all presets', () => {
    for (const preset of CALENDAR_PRESETS) {
      const months = preset.data.месяцы || [];
      for (const m of months) {
        expect(m.название).not.toMatch(/[a-zA-Z]/);
      }
      const days = preset.data.названия_дней_недели || [];
      for (const d of days) {
        expect(d).not.toMatch(/[a-zA-Z]/);
      }
    }
  });

  it('confirms and applies selected preset', () => {
    const emit = vi.fn();
    const modal = useCalendarPresetsModal({ modelValue: true }, emit);

    const preset = CALENDAR_PRESETS[0];
    modal.promptApplyPreset(preset);
    expect(modal.confirmApplyVisible.value).toBe(true);
    expect(modal.selectedPreset.value?.id).toBe(preset.id);

    modal.confirmApply();
    expect(emit).toHaveBeenCalledWith('select-preset', preset);
    expect(emit).toHaveBeenCalledWith('update:modelValue', false);
    expect(modal.confirmApplyVisible.value).toBe(false);
  });
});

