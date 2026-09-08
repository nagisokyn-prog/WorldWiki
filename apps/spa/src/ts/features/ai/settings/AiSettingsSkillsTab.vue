<template>
  <div class="ai-settings-skills-tab">
    <div class="skills-top-bar">
      <div class="skills-search-wrapper">
        <i class="fas fa-search"></i>
        <input
          v-model="searchQuery"
          type="text"
          class="skills-search-input"
          placeholder="Поиск по навыкам..."
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
            </div>
            <span class="skill-card-desc">{{ skill.description }}</span>
          </div>
        </div>

        <div class="skill-card-actions">
          <button class="btn-icon-action" title="Редактировать навык" @click="openEditModal(skill)">
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button
            v-if="skill.is_custom_author_style"
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
    <div v-if="isEditing" class="modal-overlay" @click.self="closeModal">
      <div class="skill-edit-modal">
        <div class="modal-header-row">
          <span>{{ editingSkill.id ? 'Редактирование навыка' : 'Создание нового навыка' }}</span>
          <button class="btn-icon-action" @click="closeModal">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="modal-form-body">
          <div class="form-group">
            <label>Название навыка (на русском):</label>
            <input
              v-model="editingSkill.name"
              type="text"
              class="form-input"
              placeholder="Например: Генератор диалогов"
            >
          </div>

          <div class="form-group">
            <label>Краткое описание:</label>
            <input
              v-model="editingSkill.description"
              type="text"
              class="form-input"
              placeholder="Для чего предназначен этот навык..."
            >
          </div>

          <div class="form-group">
            <label>Инструкции / Промпт навыка (Markdown):</label>
            <textarea
              v-model="editingSkill.prompt_text"
              class="form-textarea"
              placeholder="Опишите шаги, правила и ограничения для ИИ при вызове этого навыка..."
            ></textarea>
          </div>
        </div>

        <div class="modal-actions-row">
          <button class="btn-icon-action" @click="closeModal">Отмена</button>
          <button class="btn-create-skill" @click="saveSkill">Сохранить</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiSettingsSkillsTabProps, AiSettingsSkillsTabEmits } from './AiSettingsSkillsTab.model';
import { useAiSettingsSkillsTab } from './useAiSettingsSkillsTab';

const props = defineProps<AiSettingsSkillsTabProps>();
const emit = defineEmits<AiSettingsSkillsTabEmits>();

const {
  skills,
  filteredSkills,
  isLoading,
  searchQuery,
  isEditing,
  editingSkill,
  openCreateModal,
  openEditModal,
  closeModal,
  saveSkill,
  deleteSkill
} = useAiSettingsSkillsTab(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsSkillsTab.css"></style>
