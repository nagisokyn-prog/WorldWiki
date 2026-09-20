import { describe, it, expect, vi } from 'vitest';
import { useAiChatInput } from './useAiChatInput';

describe('useAiChatInput', () => {
  it('initializes with default state', () => {
    const emit = vi.fn();
    const { isFocused, isEmpty, isSkillAutocompleteOpen, skillSearchQuery } = useAiChatInput(
      { loading: false },
      emit
    );

    expect(isFocused.value).toBe(false);
    expect(isEmpty.value).toBe(true);
    expect(isSkillAutocompleteOpen.value).toBe(false);
    expect(skillSearchQuery.value).toBe('');
  });

  it('handles unlock correctly', () => {
    const emit = vi.fn();
    const { unlock } = useAiChatInput({ loading: false }, emit);
    expect(() => unlock()).not.toThrow();
  });
});
