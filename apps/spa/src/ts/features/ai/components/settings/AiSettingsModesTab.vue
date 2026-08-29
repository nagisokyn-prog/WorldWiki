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
            :options="[{ value: '', label: '-- Использовать глобальное активное подключение --' }, ...profiles.map(p => ({ value: p.id || '', label: p.name }))] " 
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

        <div class="form-actions" style="margin-top: 14px;">
          <button class="btn-primary interactive-el" @click="saveMode">
            <i class="fas fa-check"></i> Сохранить режим
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { XboxWheel } from '@worldwiki/components';
import type { AiProfile } from '../../types/ai.types';
import { aiProfilesApi } from '../../api/aiProfiles.api';

export interface AiMode {
  id?: string;
  slug: string;
  name: string;
  role_definition: string;
  custom_instructions?: string;
  allowed_tools?: string[];
  api_profile_id?: string | null;
  is_global?: boolean;
  project_id?: string;
}

const props = defineProps<{
  currentProject: string;
}>();

const emit = defineEmits(['mode-saved']);

const isLoading = ref(true);
const modes = ref<AiMode[]>([]);
const activeModeSlug = ref<string>('chat');
const activeMode = ref<AiMode | null>(null);
const isNewMode = ref(false);
const profiles = ref<AiProfile[]>([]);

onMounted(async () => {
  await loadProfiles();
  await loadModes();
});

const loadProfiles = async () => {
  try {
    if (props.currentProject) {
      profiles.value = await aiProfilesApi.getProfiles(props.currentProject);
    }
  } catch (e) {
    console.error('Ошибка загрузки профилей:', e);
  }
};

const loadModes = async () => {
  isLoading.value = true;
  try {
    const saved = localStorage.getItem(`worldwiki_modes_${props.currentProject || 'default'}`);
    if (saved) {
      modes.value = JSON.parse(saved);
    } else {
      modes.value = [
        {
          slug: 'chat',
          name: 'Собеседник',
          role_definition: 'Ты — верный помощник писателя. Отвечай дружелюбно, помогай генерировать идеи и обсуждать сюжетные повороты.',
          custom_instructions: '',
          is_global: true,
        },
        {
          slug: 'editor',
          name: 'Художественный редактор',
          role_definition: 'Ты — строгий литературный редактор. Анализируй стиль, улучшай ритмику фраз, исправляй тавтологии и подчеркивай атмосферу.',
          custom_instructions: '',
          is_global: true,
        },
        {
          slug: 'analyst',
          name: 'Хранитель лора (Аналитик)',
          role_definition: 'Ты — главный архивариус и хранитель канона вселенной. Проверяй хронологию, связи персонажей и не допускай сюжетных дыр.',
          custom_instructions: '',
          is_global: true,
        },
      ];
    }

    const current = modes.value.find(m => m.slug === activeModeSlug.value) || modes.value[0];
    if (current) {
      activeModeSlug.value = current.slug;
      activeMode.value = { ...current };
    }
  } catch (e) {
    console.error('Ошибка загрузки режимов:', e);
  } finally {
    isLoading.value = false;
  }
};

const onModeChange = () => {
  isNewMode.value = false;
  const found = modes.value.find(m => m.slug === activeModeSlug.value);
  if (found) {
    activeMode.value = { ...found };
  }
};

const createNewMode = () => {
  isNewMode.value = true;
  activeModeSlug.value = 'new_mode';
  activeMode.value = {
    slug: `mode_${Date.now()}`,
    name: 'Новый режим',
    role_definition: 'Ты — специализированный ассистент...',
    custom_instructions: '',
    api_profile_id: null,
    is_global: false,
    project_id: props.currentProject,
  };
};

const saveMode = async () => {
  if (!activeMode.value) return;
  try {
    const idx = modes.value.findIndex(m => m.slug === activeMode.value?.slug);
    if (idx >= 0) {
      modes.value[idx] = { ...activeMode.value };
    } else {
      modes.value.push({ ...activeMode.value });
    }
    localStorage.setItem(`worldwiki_modes_${props.currentProject || 'default'}`, JSON.stringify(modes.value));
    isNewMode.value = false;
    emit('mode-saved');
  } catch (e) {
    console.error('Ошибка сохранения режима:', e);
  }
};

const deleteMode = async () => {
  if (!activeMode.value) return;
  if (!confirm(`Удалить режим "${activeMode.value.name}"?`)) return;
  try {
    modes.value = modes.value.filter(m => m.slug !== activeMode.value?.slug);
    localStorage.setItem(`worldwiki_modes_${props.currentProject || 'default'}`, JSON.stringify(modes.value));
    activeModeSlug.value = 'chat';
    onModeChange();
  } catch (e) {
    console.error('Ошибка удаления режима:', e);
  }
};
</script>

<style scoped>
.modes-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.tab-intro h3 {
  margin: 0 0 6px 0;
  font-size: 18px;
  color: var(--text-color, #fff);
}
.text-muted {
  color: var(--text-muted, #8b949e);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}
.mode-selector-bar {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.selector-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.mode-editor-card {
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color, #e6edf3);
}
.field-hint {
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}
.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 40px;
  justify-content: center;
  color: var(--text-muted, #8b949e);
}
</style>
