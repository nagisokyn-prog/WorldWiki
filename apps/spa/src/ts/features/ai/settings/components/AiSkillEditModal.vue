<template>
  <div v-if="isEditing" class="modal-overlay" @click.self="$emit('close')">
    <div class="skill-edit-modal">
      <div class="modal-header-row">
        <span>{{ editingSkill.id ? 'Редактирование навыка' : 'Создание нового навыка' }}</span>
        <button class="btn-icon-action" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-form-body">
        <div class="form-group">
          <label>Название навыка:</label>
          <input
            :value="editingSkill.name"
            type="text"
            class="form-input"
            placeholder="Например: Генератор диалогов"
            @input="$emit('update-field', 'name', ($event.target as HTMLInputElement).value)"
          >
        </div>

        <div class="form-group">
          <label>Краткое описание:</label>
          <input
            :value="editingSkill.description"
            type="text"
            class="form-input"
            placeholder="Для чего предназначен этот навык..."
            @input="$emit('update-field', 'description', ($event.target as HTMLInputElement).value)"
          >
        </div>

        <div class="form-group">
          <div class="checkbox-row">
            <input
              id="skill-auto-trigger"
              :checked="Boolean(editingSkill.is_auto_trigger)"
              type="checkbox"
              class="form-checkbox"
              @change="$emit('update-field', 'is_auto_trigger', ($event.target as HTMLInputElement).checked)"
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
                <i class="fas fa-times trigger-chip-remove" @click.stop="$emit('remove-trigger', trig)"></i>
              </span>
            </div>
            <input
              :value="newTriggerInput"
              type="text"
              class="form-input trigger-field-input"
              placeholder="Введите фразу (например, 'сделай главным героем') и нажмите Enter..."
              @input="$emit('update:newTriggerInput', ($event.target as HTMLInputElement).value)"
              @keydown.enter.prevent="$emit('add-trigger')"
            >
          </div>
        </div>

        <div class="form-group">
          <label>Инструкции / Промпт навыка (Markdown):</label>
          <textarea
            :value="editingSkill.prompt_text"
            class="form-textarea"
            placeholder="Опишите шаги, правила и ограничения для ИИ при вызове этого навыка..."
            @input="$emit('update-field', 'prompt_text', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </div>
      </div>

      <div class="modal-actions-row">
        <button class="btn-icon-action" @click="$emit('close')">Отмена</button>
        <button class="btn-create-skill" @click="$emit('save')">Сохранить</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiSkillItem } from '../../skills/aiSkills.model';

defineProps<{
  isEditing: boolean;
  editingSkill: Partial<AiSkillItem>;
  newTriggerInput: string;
}>();

defineEmits<{
  (e: 'update:newTriggerInput', value: string): void;
  (e: 'update-field', field: keyof AiSkillItem, value: unknown): void;
  (e: 'close'): void;
  (e: 'add-trigger'): void;
  (e: 'remove-trigger', trig: string): void;
  (e: 'save'): void;
}>();
</script>
