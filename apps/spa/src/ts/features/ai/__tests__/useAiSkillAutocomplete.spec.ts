import { describe, it, expect, vi } from 'vitest';
import { useAiSkillAutocomplete } from '../components/useAiSkillAutocomplete';
import type { AiSkillItem } from '../components/AiSkillAutocomplete.model';

describe('useAiSkillAutocomplete', () => {
  const sampleSkills: AiSkillItem[] = [
    {
      id: 'skill_1',
      name: 'Конструктор типов сущностей',
      description: 'Создание схем данных'
    },
    {
      id: 'skill_2',
      name: 'Анализ диалогов',
      description: 'Проверка темпа и речи'
    }
  ];

  it('filters skills by search query', () => {
    const emit = vi.fn();
    const { filteredSkills } = useAiSkillAutocomplete(
      { isOpen: true, searchQuery: 'диалог', skills: sampleSkills },
      emit
    );

    expect(filteredSkills.value.length).toBe(1);
    expect(filteredSkills.value[0].name).toBe('Анализ диалогов');
  });

  it('navigates through items with moveNext and movePrev', () => {
    const emit = vi.fn();
    const { selectedIndex, moveNext, movePrev } = useAiSkillAutocomplete(
      { isOpen: true, searchQuery: '', skills: sampleSkills },
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

  it('emits select on selectSkill and selectCurrent', () => {
    const emit = vi.fn();
    const { selectSkill, selectCurrent } = useAiSkillAutocomplete(
      { isOpen: true, searchQuery: '', skills: sampleSkills },
      emit
    );

    selectSkill(sampleSkills[1]);
    expect(emit).toHaveBeenCalledWith('select', sampleSkills[1]);

    selectCurrent();
    expect(emit).toHaveBeenCalledWith('select', sampleSkills[0]);
  });
});
