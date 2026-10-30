import { describe, it, expect, vi } from 'vitest';
import { usePlanetPresetsModal } from './usePlanetPresetsModal';
import { PLANET_PRESETS } from '../presets/planet.presets';

describe('usePlanetPresetsModal', () => {
  it('loads all 7 planet presets and extracts tags', () => {
    const emit = vi.fn();
    const modal = usePlanetPresetsModal({ modelValue: true }, emit);

    expect(modal.filteredPresets.value.length).toBe(7);
    expect(modal.availableTags.value).toContain('all');
    expect(modal.availableTags.value).toContain('Реальный мир');
    expect(modal.availableTags.value).toContain('Астрономия');
    expect(modal.availableTags.value).toContain('Фэнтези');
  });

  it('filters presets by tag', () => {
    const emit = vi.fn();
    const modal = usePlanetPresetsModal({ modelValue: true }, emit);

    modal.selectTag('Реальный мир');
    expect(modal.filteredPresets.value.length).toBe(2);
    expect(modal.filteredPresets.value.map((p) => p.id)).toEqual(['earth', 'mars']);
  });

  it('filters presets by search query in Russian', () => {
    const emit = vi.fn();
    const modal = usePlanetPresetsModal({ modelValue: true }, emit);

    modal.searchQuery.value = 'Венера';
    expect(modal.filteredPresets.value.length).toBe(1);
    expect(modal.filteredPresets.value[0].id).toBe('venus');

    modal.searchQuery.value = 'ретроградное';
    expect(modal.filteredPresets.value.length).toBeGreaterThanOrEqual(1);
  });

  it('prompts and applies selected planet preset', () => {
    const emit = vi.fn();
    const modal = usePlanetPresetsModal({ modelValue: true }, emit);

    const earthPreset = PLANET_PRESETS[0];
    modal.promptApplyPreset(earthPreset);
    expect(modal.confirmApplyVisible.value).toBe(true);
    expect(modal.selectedPreset.value?.id).toBe('earth');

    modal.confirmApply();
    expect(emit).toHaveBeenCalledWith('select-preset', earthPreset);
    expect(emit).toHaveBeenCalledWith('update:modelValue', false);
    expect(modal.confirmApplyVisible.value).toBe(false);
  });
});

