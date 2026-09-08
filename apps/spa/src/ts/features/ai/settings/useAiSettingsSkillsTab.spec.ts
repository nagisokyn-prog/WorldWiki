import { describe, it, expect, vi } from 'vitest';
import { useAiSettingsSkillsTab } from './useAiSettingsSkillsTab';

describe('useAiSettingsSkillsTab', () => {
  it('initializes with default state', () => {
    const emit = vi.fn();
    const { skills, isLoading, isEditing, searchQuery } = useAiSettingsSkillsTab(
      { currentProject: 'test_project' },
      emit
    );

    expect(isLoading.value).toBe(false);
    expect(isEditing.value).toBe(false);
    expect(searchQuery.value).toBe('');
    expect(skills.value.length).toBeGreaterThanOrEqual(0);
  });

  it('filters skills by search query', () => {
    const emit = vi.fn();
    const { searchQuery, filteredSkills, skills } = useAiSettingsSkillsTab(
      { currentProject: 'test_project' },
      emit
    );

    skills.value = [
      { id: '1', name: 'Конструктор типов', description: 'Описание 1', is_unlocked: true },
      { id: '2', name: 'Анализ сцены', description: 'Описание 2', is_unlocked: true }
    ];

    searchQuery.value = 'Конструктор';
    expect(filteredSkills.value.length).toBe(1);
    expect(filteredSkills.value[0].name).toBe('Конструктор типов');

    searchQuery.value = 'несуществующий';
    expect(filteredSkills.value.length).toBe(0);
  });

  it('opens and closes modal correctly', () => {
    const emit = vi.fn();
    const { isEditing, editingSkill, openCreateModal, closeModal } = useAiSettingsSkillsTab(
      { currentProject: 'test_project' },
      emit
    );

    openCreateModal();
    expect(isEditing.value).toBe(true);
    expect(editingSkill.value.name).toBe('');

    closeModal();
    expect(isEditing.value).toBe(false);
  });
});
