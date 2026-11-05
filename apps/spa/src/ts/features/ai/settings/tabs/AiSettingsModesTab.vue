<template>
  <div class="modes-tab">
    <div v-if="isLoading" class="loading-state">
      <i class="fas fa-spinner fa-spin"></i> Загрузка режимов...
    </div>
    
    <div v-else class="modes-container">
      <div class="tab-intro">
        <h3>Режимы и роли ИИ-помощника</h3>
        <p class="text-muted">
          Настройте поведение и специализацию ассистента для разных задач: от дружелюбного мозгового штурма до строгого редактирования глав.
        </p>
      </div>

      <div class="mode-selector-bar">
        <label class="form-label">Выбранный режим</label>
        <div class="flex gap-2 items-center">
          <div class="flex-1">
            <XboxWheel 
              :model-value="activeModeSlug" 
              :options="modes.map(m => ({ value: m.slug, label: `${m.name} (${m.slug})` }))" 
              placeholder="Выберите режим..." 
              @update:model-value="val => { activeModeSlug = String(val); onModeChange(); }" 
            />
          </div>
          <button class="btn-secondary-outline interactive-el" title="Создать новый режим" @click="createNewMode">
            <i class="fas fa-plus"></i> Новый
          </button>
          <button 
            v-if="activeMode && !activeMode.is_global && !isNewMode" 
            class="btn-danger-outline interactive-el" 
            title="Удалить режим" 
            @click="deleteMode"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>

      <div v-if="activeMode" class="mode-editor-card">
        <div class="form-row-2">
          <div class="form-group">
            <label>Уникальный идентификатор (Slug)</label>
            <input 
              v-model="activeMode.slug" 
              type="text" 
              class="input-base interactive-el" 
              :disabled="!isNewMode" 
              placeholder="например: writer, editor, analyst"
            />
          </div>
          
          <div class="form-group">
            <label>Отображаемое название</label>
            <input 
              v-model="activeMode.name" 
              type="text" 
              class="input-base interactive-el" 
              placeholder="например: Художественный редактор"
            />
          </div>
        </div>
        
        <div class="form-group">
          <label>Профиль подключения (Опционально)</label>
          <XboxWheel 
            :model-value="activeMode.api_profile_id || ''" 
            :options="[{ value: '', label: '-- Использовать глобальное активное подключение --' }, ...profiles.map((p: AiProfile) => ({ value: p.id || '', label: p.name }))] " 
            placeholder="-- Использовать глобальное активное подключение --" 
            @update:model-value="val => { if (activeMode) activeMode.api_profile_id = (val ? String(val) : null); }" 
          />
          <span class="field-hint">Позволяет закрепить за конкретным режимом отдельную модель (например, Claude для Редактора).</span>
        </div>

        <div class="form-group">
          <label>Роль и характер ассистента (Системная инструкция)</label>
          <textarea 
            v-model="activeMode.role_definition" 
            class="input-base interactive-el" 
            rows="5" 
            placeholder="Ты — опытный редактор и литературный критик. Твоя задача — находить стилистические шероховатости, анализировать темп повествования..."
          ></textarea>
        </div>

        <div class="form-group">
          <label>Дополнительные правила и ограничения</label>
          <textarea 
            v-model="activeMode.custom_instructions" 
            class="input-base interactive-el" 
            rows="3" 
            placeholder="Всегда сохраняй мрачный тон вселенной; не предлагай прямых реплик за главного героя без запроса..."
          ></textarea>
        </div>

        <div class="form-actions mt-3">
          <button class="btn-primary interactive-el" @click="saveMode">
            <i class="fas fa-check"></i> Сохранить режим
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XboxWheel } from '@worldwiki/components';
import type { AiProfile } from '@/features/ai/types/ai.types';
import { 
  useAiSettingsModesTab, 
  type AiSettingsModesTabProps, 
  type AiSettingsModesTabEmits,
  type AiMode 
} from './useAiSettingsModesTab';

export type { AiMode };

const props = defineProps<AiSettingsModesTabProps>();
const emit = defineEmits<AiSettingsModesTabEmits>();

const {
  isLoading,
  modes,
  activeModeSlug,
  activeMode,
  isNewMode,
  profiles,
  onModeChange,
  createNewMode,
  saveMode,
  deleteMode
} = useAiSettingsModesTab(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsModesTab.css"></style>
