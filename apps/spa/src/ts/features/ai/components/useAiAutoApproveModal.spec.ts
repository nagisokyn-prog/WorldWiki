import { describe, it, expect } from 'vitest';
import { useAiAutoApproveModal } from './useAiAutoApproveModal';

describe('useAiAutoApproveModal', () => {
  it('computes badgeText correctly based on active categories', () => {
    const { autoApproveState, badgeText } = useAiAutoApproveModal({
      currentProject: 'proj_1',
      activeModeSlug: 'chat'
    });

    autoApproveState.value = {
      read: true,
      timeline: false,
      edit_entities: false,
      edit_text: false,
      audit: false,
      subagents: false
    };

    expect(badgeText.value).toBe('Авто: Чтение');

    autoApproveState.value.timeline = true;
    expect(badgeText.value).toBe('Авто: Чтение, Хронология');

    autoApproveState.value = {
      read: true,
      timeline: true,
      edit_entities: true,
      edit_text: true,
      audit: true,
      subagents: true
    };
    expect(badgeText.value).toBe('Авто: Все (6)');
  });
});
