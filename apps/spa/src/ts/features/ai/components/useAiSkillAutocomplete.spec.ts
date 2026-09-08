import { describe, it, expect, vi } from 'vitest';
import { useAiSkillAutocomplete } from './useAiSkillAutocomplete';

describe('useAiSkillAutocomplete', () => {
  const mockSkills = [
    { id: '1', name: 'Конструктор типов сущностей', description: 'Создание схем' },
    { id: '2', name: 'Анализ диалогов', description: 'Проверка реплик' }
  ];

  it('filters skills based on searchQuery', () => {
    const emit = vi.fn();
    const { filteredSkills } = useAiSkillAutocomplete(
      { isOpen: true, searchQuery: 'конструкт', skills: mockSkills },
      emit
    );

    expect(filteredSkills.value.length).toBe(1);
    expect(filteredSkills.value[0].name).toBe('Конструктор типов сущностей');
  });

  it('navigates through items with moveNext and movePrev', () => {
    const emit = vi.fn();
    const { selectedIndex, moveNext, movePrev } = useAiSkillAutocomplete(
      { isOpen: true, searchQuery: '', skills: mockSkills },
      emit
    );

    expect(selectedIndex.value).toBe(0);
    moveNext();
    expect(selectedIndex.value).toBe(1);
    moveNext();
    expect(selectedIndex.value).toBe(0);
    movePrev();
    expect(selectedIndex.value).toBe(1);
  });

  it('emits select event on selectCurrent', () => {
    const emit = vi.fn();
    const { selectCurrent } = useAiSkillAutocomplete(
      { isOpen: true, searchQuery: '', skills: mockSkills },
      emit
    );

    selectCurrent();
    expect(emit).toHaveBeenCalledWith('select', mockSkills[0]);
  });
});
