<template>
  <div v-if="isOpen" class="ai-skill-autocomplete">
    <div class="skill-autocomplete-header">
      <span>Навыки ИИ (!"имя")</span>
      <i class="fas fa-magic"></i>
    </div>

    <div v-if="filteredSkills.length === 0" class="skill-empty">
      Навыки не найдены
    </div>

    <div
      v-for="(skill, index) in filteredSkills"
      :key="skill.id"
      class="skill-item"
      :class="{ 'is-selected': index === selectedIndex }"
      @click="selectSkill(skill)"
    >
      <i class="fas fa-bolt skill-item-icon"></i>
      <div class="skill-item-info">
        <span class="skill-item-name">{{ skill.name }}</span>
        <span class="skill-item-desc">{{ skill.description }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiSkillAutocompleteProps, AiSkillAutocompleteEmits } from './AiSkillAutocomplete.model';
import { useAiSkillAutocomplete } from './useAiSkillAutocomplete';

const props = defineProps<AiSkillAutocompleteProps>();
const emit = defineEmits<AiSkillAutocompleteEmits>();

const {
  selectedIndex,
  filteredSkills,
  selectSkill,
  selectCurrent,
  moveNext,
  movePrev
} = useAiSkillAutocomplete(props, emit);

defineExpose({
  selectCurrent,
  moveNext,
  movePrev
});
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSkillAutocomplete.css"></style>
