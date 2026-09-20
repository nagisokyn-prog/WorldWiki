<template>
  <div class="ai-settings-skills-tab">
    <div class="skills-top-bar">
      <div class="skills-search-wrapper">
        <i class="fas fa-search"></i>
        <input
          v-model="searchQuery"
          type="text"
          class="skills-search-input"
          placeholder="Поиск по навыкам и триггерам..."
        >
      </div>
      <button class="btn-create-skill" @click="openCreateModal">
        <i class="fas fa-plus"></i> Новый навык
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <i class="fas fa-spinner fa-spin"></i> Загрузка навыков...
    </div>

    <div v-else class="skills-list">
      <div v-for="skill in filteredSkills" :key="skill.id" class="skill-card">
        <div class="skill-card-main">
          <i class="fas fa-magic skill-card-icon"></i>
          <div class="skill-card-body">
            <div class="skill-card-title">
              <span>{{ skill.name }}</span>
              <span class="skill-trigger-tag">!"{{ skill.name }}"</span>
              <span v-if="skill.is_builtin" class="skill-badge-builtin">Системный</span>
              <span v-else class="skill-badge-custom">Авторский</span>
            </div>
            <span class="skill-card-desc">{{ skill.description }}</span>
            
            <div v-if="skill.triggers && skill.triggers.length > 0" class="skill-triggers-preview">
              <span class="triggers-label">🎯 Авто-триггеры:</span>
              <span
                v-for="trig in skill.triggers.slice(0, 4)"
                :key="trig"
                class="trigger-chip-sm"
              >
                {{ trig }}
              </span>
              <span v-if="skill.triggers.length > 4" class="trigger-chip-more">
                +{{ skill.triggers.length - 4 }}
              </span>
            </div>
          </div>
        </div>

        <div class="skill-card-actions">
          <button class="btn-icon-action" title="Редактировать навык" @click="openEditModal(skill)">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button
            v-if="skill.is_custom_author_style && !skill.is_builtin"
            class="btn-icon-action danger"
            title="Удалить навык"
            @click="deleteSkill(skill.id)"
          >
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Модалка создания/редактирования навыка -->
    <AiSkillEditModal
      :is-editing="isEditing"
      :editing-skill="editingSkill"
      :new-trigger-input="newTriggerInput"
      @update:new-trigger-input="newTriggerInput = $event"
      @close="closeModal"
      @add-trigger="addTrigger"
      @remove-trigger="removeTrigger"
      @save="saveSkill"
    />
  </div>
</template>

<script setup lang="ts">
import AiSkillEditModal from './components/AiSkillEditModal.vue';
import type { AiSettingsSkillsTabProps, AiSettingsSkillsTabEmits } from './AiSettingsSkillsTab.model';
import { useAiSettingsSkillsTab } from './useAiSettingsSkillsTab';

const props = defineProps<AiSettingsSkillsTabProps>();
const emit = defineEmits<AiSettingsSkillsTabEmits>();

const {
  filteredSkills,
  isLoading,
  searchQuery,
  isEditing,
  editingSkill,
  newTriggerInput,
  openCreateModal,
  openEditModal,
  closeModal,
  addTrigger,
  removeTrigger,
  saveSkill,
  deleteSkill
} = useAiSettingsSkillsTab(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsSkillsTab.css"></style>
