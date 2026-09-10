import { describe, it, expect } from 'vitest';
import { useAiAutoApproveModal } from './useAiAutoApproveModal';

describe('useAiAutoApproveModal', () => {
  it('computes badgeText correctly based on active categories', () => {
    const emit = () => {};
    const { state, badgeText } = useAiAutoApproveModal({
      currentProject: 'proj_1',
      activeModeSlug: 'editor'
    }, emit as any);

    state.value.enabled = true;
    state.value.categories = {
      read: true,
      write: false,
      delete: false,
      timeline: false,
      audit: false,
      delegate: false
    };

    expect(badgeText.value).toBe('Авто: Чтение');

    state.value.categories.timeline = true;
    expect(badgeText.value).toBe('Авто: Чтение, Хронология');

    state.value.categories = {
      read: true,
      write: true,
      delete: true,
      timeline: true,
      audit: true,
      delegate: true
    };
    expect(badgeText.value).toBe('Авто: Все (Чтение, Запись, Удаление, Хронология)');
  });
});
