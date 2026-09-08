import { ref, computed, watch } from 'vue';
import type { AiSkillAutocompleteProps, AiSkillAutocompleteEmits, AiSkillItem } from './AiSkillAutocomplete.model';

export function useAiSkillAutocomplete(
  props: AiSkillAutocompleteProps,
  emit: AiSkillAutocompleteEmits
) {
  const selectedIndex = ref(0);

  const filteredSkills = computed<AiSkillItem[]>(() => {
    const q = (props.searchQuery || '').toLowerCase().trim();
    if (!q) return props.skills;
    return props.skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  });

  watch(
    () => filteredSkills.value.length,
    () => {
      selectedIndex.value = 0;
    }
  );

  const selectSkill = (skill: AiSkillItem) => {
    emit('select', skill);
  };

  const selectCurrent = () => {
    if (filteredSkills.value.length > 0 && selectedIndex.value < filteredSkills.value.length) {
      selectSkill(filteredSkills.value[selectedIndex.value]);
    }
  };

  const moveNext = () => {
    if (filteredSkills.value.length === 0) return;
    selectedIndex.value = (selectedIndex.value + 1) % filteredSkills.value.length;
  };

  const movePrev = () => {
    if (filteredSkills.value.length === 0) return;
    selectedIndex.value =
      (selectedIndex.value - 1 + filteredSkills.value.length) % filteredSkills.value.length;
  };

  return {
    selectedIndex,
    filteredSkills,
    selectSkill,
    selectCurrent,
    moveNext,
    movePrev
  };
}
