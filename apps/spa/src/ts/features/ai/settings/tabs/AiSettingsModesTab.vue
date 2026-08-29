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

const defaultSystemModes: AiMode[] = [
  {
    slug: 'chat',
    name: 'Свободный чат',
    role_definition: 'Ты — дружелюбный творческий собеседник и помощник писателя. Отвечай подробно, по делу, помогай развивать идеи.',
    is_global: true
  },
  {
    slug: 'writer',
    name: 'Соавтор (Генерация прозы)',
    role_definition: 'Ты — опытный писатель художественной литературы. Пиши выразительно, кинематографично, соблюдай принцип "показывай, а не рассказывай".',
    is_global: true
  },
  {
    slug: 'editor',
    name: 'Литературный редактор',
    role_definition: 'Ты — строгий литературный редактор. Находи повторы, канцелярит, стилистические сбои и логические дыры в тексте.',
    is_global: true
  },
  {
    slug: 'lore_master',
    name: 'Хранитель лора (Архивариус)',
    role_definition: 'Ты — Хранитель Энциклопедии Мира. Твоя задача — строго следить за каноном, проверять хронологию и родственные связи персонажей.',
    is_global: true
  }
];

const loadModes = async () => {
  isLoading.value = true;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const custom = await invoke<AiMode[]>('get_ai_modes', { projectId: props.currentProject || null }).catch(() => []);
    modes.value = [...defaultSystemModes, ...(custom || [])];
    
    onModeChange();
  } catch (e) {
    console.error('Ошибка загрузки режимов:', e);
    modes.value = [...defaultSystemModes];
    onModeChange();
  } finally {
    isLoading.value = false;
  }
};

const onModeChange = () => {
  isNewMode.value = false;
  const found = modes.value.find(m => m.slug === activeModeSlug.value);
  if (found) {
    activeMode.value = { ...found };
  } else if (modes.value.length > 0) {
    activeMode.value = { ...modes.value[0] };
    activeModeSlug.value = modes.value[0].slug;
  }
};

const createNewMode = () => {
  isNewMode.value = true;
  activeMode.value = {
    slug: 'custom_' + Date.now().toString().slice(-4),
    name: 'Новый режим',
    role_definition: '',
    custom_instructions: '',
    is_global: false,
    project_id: props.currentProject
  };
  activeModeSlug.value = activeMode.value.slug;
};

const saveMode = async () => {
  if (!activeMode.value) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_ai_mode', { mode: activeMode.value, projectId: props.currentProject || null });
    isNewMode.value = false;
    await loadModes();
    emit('mode-saved', activeMode.value.slug);
    const { appAlert } = await import('@worldwiki/components');
    appAlert('Режим успешно сохранён!');
  } catch (e) {
    console.error('Ошибка сохранения режима:', e);
    const { appAlert } = await import('@worldwiki/components');
    appAlert('Не удалось сохранить режим: ' + e);
  }
};

const deleteMode = async () => {
  if (!activeMode.value || activeMode.value.is_global) return;
  const { appConfirm } = await import('@worldwiki/components');
  if (!await appConfirm(`Удалить режим "${activeMode.value.name}"?`)) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('delete_ai_mode', { slug: activeMode.value.slug, projectId: props.currentProject || null });
    activeModeSlug.value = 'chat';
    await loadModes();
  } catch (e) {
    console.error('Ошибка удаления режима:', e);
  }
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSettingsModesTab.css"></style>
