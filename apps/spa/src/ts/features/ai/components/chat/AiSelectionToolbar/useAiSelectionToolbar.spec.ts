import { describe, it, expect, vi } from 'vitest';
import { useAiSelectionToolbar } from './useAiSelectionToolbar';

describe('useAiSelectionToolbar', () => {
  it('should initialize with hidden position', () => {
    const askSpy = vi.fn();
    const loreSpy = vi.fn();
    const { position } = useAiSelectionToolbar((e, payload) => {
      if (e === 'ask-wowilon') askSpy(payload);
      if (e === 'add-to-lore') loreSpy(payload);
    });

    expect(position.value.visible).toBe(false);
  });

  it('should emit ask-wowilon with selected text and close toolbar', () => {
    const askSpy = vi.fn();
    const { onAskWoWiLon, position, selectedText } = useAiSelectionToolbar((e, payload) => {
      if (e === 'ask-wowilon') askSpy(payload);
    });

    selectedText.value = 'Латный доспех';
    position.value.visible = true;

    onAskWoWiLon();

    expect(askSpy).toHaveBeenCalledWith({
      selected_text: 'Латный доспех',
      source_message_id: undefined,
    });
    expect(position.value.visible).toBe(false);
  });
});
