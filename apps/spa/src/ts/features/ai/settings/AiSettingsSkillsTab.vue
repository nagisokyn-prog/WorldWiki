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
            <label>Название навыка:</label>
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
            <div class="checkbox-row">
              <input
                id="skill-auto-trigger"
                v-model="editingSkill.is_auto_trigger"
                type="checkbox"
                class="form-checkbox"
              >
              <label for="skill-auto-trigger" class="checkbox-label">
                Автоматически подключать при наличии фраз-триггеров в сообщении
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>🎯 Фразы-триггеры (нажмите Enter для добавления):</label>
            <div class="triggers-input-box">
              <div class="triggers-chip-container">
                <span
                  v-for="trig in editingSkill.triggers || []"
                  :key="trig"
                  class="trigger-chip"
                >
                  {{ trig }}
                  <i class="fas fa-times trigger-chip-remove" @click.stop="removeTrigger(trig)"></i>
                </span>
              </div>
              <input
                v-model="newTriggerInput"
                type="text"
                class="form-input trigger-field-input"
                placeholder="Введите фразу (например, 'сделай главным героем') и нажмите Enter..."
                @keydown.enter.prevent="addTrigger"
              >
            </div>
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
