import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiAutoApproveModal } from '../components/useAiAutoApproveModal';

describe('useAiAutoApproveModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('filters available categories for companion mode (read, timeline)', () => {
    const emit = vi.fn();
    const { state, availableCategories, activeCount, badgeText } = useAiAutoApproveModal(
      { currentProject: 'p_test', activeModeSlug: 'companion' },
      emit
    );

    expect(availableCategories.value.map((c) => c.key)).toEqual(['read', 'timeline']);
    expect(state.value.enabled).toBe(true);
    expect(activeCount.value).toBe(2); // read and timeline are true by default
    expect(badgeText.value).toBe('Авто: Все (Чтение, Хронология)');
  });

  it('filters available categories for editor mode (read, write, delete, timeline)', () => {
    const emit = vi.fn();
    const { state, availableCategories, activeCount, badgeText } = useAiAutoApproveModal(
      { currentProject: 'p_test', activeModeSlug: 'editor' },
      emit
    );

    expect(availableCategories.value.map((c) => c.key)).toEqual(['read', 'write', 'delete', 'timeline']);
    expect(activeCount.value).toBe(2); // read, timeline are true; write, delete are false
    expect(badgeText.value).toBe('Авто: Чтение, Хронология');
  });

  it('filters available categories for analyst mode (read, timeline, audit, delegate)', () => {
    const emit = vi.fn();
    const { state, availableCategories, activeCount, badgeText } = useAiAutoApproveModal(
      { currentProject: 'p_test', activeModeSlug: 'analyst' },
      emit
    );

    expect(availableCategories.value.map((c) => c.key)).toEqual(['read', 'timeline', 'audit', 'delegate']);
    expect(activeCount.value).toBe(3); // read, timeline, audit are true; delegate is false
    expect(badgeText.value).toBe('Авто: Чтение, Хронология, Аудит');
  });

  it('setAll enables all available mode categories and updates badge', () => {
    const emit = vi.fn();
    const { state, setAll, badgeText, activeCount } = useAiAutoApproveModal(
      { currentProject: 'p_test', activeModeSlug: 'editor' },
      emit
    );

    setAll();
    expect(activeCount.value).toBe(4);
    expect(badgeText.value).toBe('Авто: Все (Чтение, Запись, Удаление, Хронология)');
    expect(state.value.categories.write).toBe(true);
    expect(state.value.categories.delete).toBe(true);
  });

  it('setNone clears categories and updates badge', () => {
    const emit = vi.fn();
    const { setNone, badgeText, activeCount } = useAiAutoApproveModal(
      { currentProject: 'p_test', activeModeSlug: 'editor' },
      emit
    );

    setNone();
    expect(activeCount.value).toBe(0);
    expect(badgeText.value).toBe('Спрашивать всегда');
  });

  it('toggleCategory toggles specific category', () => {
    const emit = vi.fn();
    const { state, toggleCategory } = useAiAutoApproveModal(
      { currentProject: 'p_test', activeModeSlug: 'editor' },
      emit
    );

    expect(state.value.categories.write).toBe(false);
    toggleCategory('write');
    expect(state.value.categories.write).toBe(true);
  });
});

