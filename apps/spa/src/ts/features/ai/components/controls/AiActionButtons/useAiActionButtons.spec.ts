import { describe, it, expect, vi } from 'vitest';
import { useAiActionButtons } from './useAiActionButtons';
import type { AiActionButtonsProps } from './AiActionButtons.model';

describe('useAiActionButtons', () => {
  it('computes isVisible correctly for various prop combinations', () => {
    const emit = vi.fn();
    
    // Hidden when all false
    const { isVisible: v1 } = useAiActionButtons({ isGenerating: false, hasError: false, canResume: false }, emit as any);
    expect(v1.value).toBe(false);

    // Visible when isGenerating
    const { isVisible: v2 } = useAiActionButtons({ isGenerating: true }, emit as any);
    expect(v2.value).toBe(true);

    // Visible when hasError
    const { isVisible: v3 } = useAiActionButtons({ hasError: true }, emit as any);
    expect(v3.value).toBe(true);

    // Visible when canResume
    const { isVisible: v4 } = useAiActionButtons({ canResume: true }, emit as any);
    expect(v4.value).toBe(true);
  });

  it('emits action events symmetrically', () => {
    const emit = vi.fn();
    const props: AiActionButtonsProps = { isGenerating: true };
    const { handleCancel, handleUnloadModels, handleRetry, handleResume } = useAiActionButtons(props, emit as any);

    handleCancel();
    expect(emit).toHaveBeenCalledWith('cancel');

    handleUnloadModels();
    expect(emit).toHaveBeenCalledWith('unload-models');

    handleRetry();
    expect(emit).toHaveBeenCalledWith('retry');

    handleResume();
    expect(emit).toHaveBeenCalledWith('resume');
  });
});
