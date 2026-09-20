import { describe, it, expect, vi } from 'vitest';
import { useAiModeSelector } from '../components';

describe('useAiModeSelector', () => {
  it('initializes with default modes and normalizes activeModeSlug', () => {
    const emit = vi.fn();
    const { personaModes, activeNormalizedSlug, currentMode } = useAiModeSelector(
      { activeModeSlug: 'edit' },
      emit
    );

    expect(personaModes.value.length).toBe(3);
    expect(activeNormalizedSlug.value).toBe('editor');
    expect(currentMode.value.slug).toBe('editor');
    expect(currentMode.value.name).toBe('Редактор');
  });

  it('normalizes chat and analyze slugs correctly', () => {
    const emit = vi.fn();
    const { activeNormalizedSlug: chatNorm } = useAiModeSelector({ activeModeSlug: 'chat' }, emit);
    expect(chatNorm.value).toBe('companion');

    const { activeNormalizedSlug: analyzeNorm } = useAiModeSelector({ activeModeSlug: 'analyze' }, emit);
    expect(analyzeNorm.value).toBe('analyst');
  });

  it('selectMode emits change-mode and closes popover', () => {
    const emit = vi.fn();
    const { isOpen, togglePopover, selectMode } = useAiModeSelector(
      { activeModeSlug: 'companion' },
      emit
    );

    togglePopover();
    expect(isOpen.value).toBe(true);

    selectMode('editor');
    expect(emit).toHaveBeenCalledWith('change-mode', 'editor');
    expect(isOpen.value).toBe(false);
  });

  it('cycleMode advances to the next persona mode', () => {
    const emit = vi.fn();
    const { cycleMode } = useAiModeSelector(
      { activeModeSlug: 'companion' },
      emit
    );

    cycleMode();
    expect(emit).toHaveBeenCalledWith('change-mode', 'editor');
  });
});
