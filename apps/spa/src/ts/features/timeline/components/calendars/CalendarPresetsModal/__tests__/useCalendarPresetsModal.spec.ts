import { describe, it, expect, vi } from 'vitest';
import { useCalendarPresetsModal } from '../useCalendarPresetsModal';
import { CALENDAR_PRESETS } from '../../presets';

describe('useCalendarPresetsModal', () => {
  it('initializes with all presets available', () => {
    const emit = vi.fn();
    const modal = useCalendarPresetsModal({ modelValue: true }, emit);

    expect(modal.filteredPresets.value.length).toBe(CALENDAR_PRESETS.length);
    expect(modal.activeCategory.value).toBe('all');
  });

  it('filters presets by category correctly', () => {
    const emit = vi.fn();
    const modal = useCalendarPresetsModal({ modelValue: true }, emit);

    modal.selectCategory('fantasy');
    expect(modal.filteredPresets.value.every((p) => p.category === 'fantasy')).toBe(true);
    expect(modal.filteredPresets.value.length).toBeGreaterThan(0);

    modal.selectCategory('real_world');
    expect(modal.filteredPresets.value.every((p) => p.category === 'real_world')).toBe(true);
  });

  it('filters presets by search query', () => {
    const emit = vi.fn();
    const modal = useCalendarPresetsModal({ modelValue: true }, emit);

    modal.searchQuery.value = 'Толкин';
    expect(modal.filteredPresets.value.some((p) => p.id === 'shire_tolkien')).toBe(true);
    expect(modal.filteredPresets.value.length).toBe(1);

    modal.searchQuery.value = 'Харптос';
    expect(modal.filteredPresets.value.some((p) => p.id === 'harptos_faerun')).toBe(true);
  });

  it('handles apply preset flow and emits select-preset', () => {
    const emit = vi.fn();
    const modal = useCalendarPresetsModal({ modelValue: true }, emit);

    const preset = CALENDAR_PRESETS[0];
    modal.promptApplyPreset(preset);

    expect(modal.confirmApplyVisible.value).toBe(true);
    expect(modal.selectedPreset.value).toBe(preset);

    modal.confirmApply();
    expect(emit).toHaveBeenCalledWith('select-preset', preset);
    expect(emit).toHaveBeenCalledWith('update:modelValue', false);
    expect(modal.confirmApplyVisible.value).toBe(false);
  });
});

