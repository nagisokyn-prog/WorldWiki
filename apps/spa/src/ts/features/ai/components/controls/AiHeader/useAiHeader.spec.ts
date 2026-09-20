import { describe, it, expect, vi } from 'vitest';
import { useAiHeader } from './useAiHeader';

describe('useAiHeader', () => {
  it('manages current mode reactivity', () => {
    const emit = vi.fn();
    const { currentMode, setMode } = useAiHeader({}, emit as any);

    expect(currentMode.value).toBe('chat');
    setMode('edit');
    expect(currentMode.value).toBe('edit');
    setMode('analyze');
    expect(currentMode.value).toBe('analyze');
  });

  it('emits action events properly', () => {
    const emit = vi.fn();
    const { handleOpenSettings, handleDetach, handleClose } = useAiHeader({ isDetached: false }, emit as any);

    handleOpenSettings();
    expect(emit).toHaveBeenCalledWith('open-settings');

    handleDetach();
    expect(emit).toHaveBeenCalledWith('detach');

    handleClose();
    expect(emit).toHaveBeenCalledWith('close');
  });
});
