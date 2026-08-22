<template>
  <div v-if="activeProfile" class="ai-chat-top-bar">
    <div class="top-bar-content">
      <div class="sidebar-toggle" style="margin-right: 12px; display: flex; align-items: center; cursor: pointer;" title="Переключить боковую панель" @click="$emit('toggle-sidebar')">
        <div role="button" class="ds-button ds-button--iconLabelPrimary ds-button--icon ds-button--capsule ds-button--m ds-button--icon-relative-m" style="--dsl-button-height: 34px;" tabindex="0">
          <div class="ds-button__background"></div>
          <div class="ds-button__icon ds-button__icon--last-child">
            <div class="ds-icon" style="font-size: inherit;">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.67272 0.522841C10.8339 0.522841 11.76 0.522714 12.4963 0.602493C13.2453 0.683657 13.8789 0.854248 14.4264 1.25197C14.7504 1.48739 15.0355 1.77247 15.2709 2.0965C15.6686 2.64394 15.8392 3.27758 15.9204 4.02655C16.0002 4.7629 16 5.68895 16 6.85014V9.14986C16 10.3111 16.0002 11.2371 15.9204 11.9735C15.8392 12.7224 15.6686 13.3561 15.2709 13.9035C15.0355 14.2275 14.7504 14.5126 14.4264 14.748C13.8789 15.1458 13.2453 15.3163 12.4963 15.3975C11.76 15.4773 10.8339 15.4772 9.67272 15.4772H6.3273C5.16611 15.4772 4.24006 15.4773 3.50371 15.3975C2.75474 15.3163 2.1211 15.1458 1.57366 14.748C1.24963 14.5126 0.964549 14.2275 0.729131 13.9035C0.331407 13.3561 0.160817 12.7224 0.0796529 11.9735C-0.000126137 11.2371 1.25338e-09 10.3111 1.25338e-09 9.14986V6.85014C1.25329e-09 5.68895 -0.000126137 4.7629 0.0796529 4.02655C0.160817 3.27758 0.331407 2.64394 0.729131 2.0965C0.964549 1.77247 1.24963 1.48739 1.57366 1.25197C2.1211 0.854248 2.75474 0.683657 3.50371 0.602493C4.24006 0.522714 5.16611 0.522841 6.3273 0.522841H9.67272ZM5.54303 1.88715V14.1118C5.78636 14.1128 6.04709 14.1169 6.3273 14.1169H9.67272C10.8639 14.1169 11.7032 14.1164 12.3493 14.0465C12.9824 13.9779 13.3497 13.8494 13.6268 13.6482C13.8354 13.4966 14.0195 13.3125 14.1711 13.1039C14.3723 12.8268 14.5007 12.4595 14.5693 11.8264C14.6393 11.1803 14.6398 10.341 14.6398 9.14986V6.85014C14.6398 5.65896 14.6393 4.81967 14.5693 4.1736C14.5007 3.54048 14.3723 3.17318 14.1711 2.89609C14.0195 2.68747 13.8354 2.50337 13.6268 2.35179C13.3497 2.1506 12.9824 2.02212 12.3493 1.95353C11.7032 1.88358 10.8639 1.88307 9.67272 1.88307H6.3273C6.04709 1.88307 5.78636 1.8862 5.54303 1.88715ZM4.1828 1.91166C3.99125 1.9216 3.8148 1.93577 3.65076 1.95353C3.01764 2.02212 2.65034 2.1506 2.37325 2.35179C2.16463 2.50337 1.98052 2.68747 1.82895 2.89609C1.62776 3.17318 1.49928 3.54048 1.43069 4.1736C1.36074 4.81967 1.36023 5.65896 1.36023 6.85014V9.14986C1.36023 10.341 1.36074 11.1803 1.43069 11.8264C1.49928 12.4595 1.62776 12.8268 1.82895 13.1039C1.98052 13.3125 2.16463 13.4966 2.37325 13.6482C2.65034 13.8494 3.01764 13.9779 3.65076 14.0465C3.81478 14.0642 3.99127 14.0774 4.1828 14.0873V1.91166Z" fill="currentColor"></path></svg>
            </div>
          </div>
        </div>
      </div>
      <div class="mode-switcher" style="margin-right: 12px; display: flex; align-items: center; gap: 4px;">
        <i class="fas fa-theater-masks"></i>
        <select 
          class="mode-select" 
          :value="activeModeSlug" 
          @change="$emit('change-mode', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="m in modes" :key="m.slug" :value="m.slug">{{ m.name }}</option>
        </select>
      </div>

      <div class="model-name">
        <i class="fas fa-microchip"></i>
        <span>{{ activeProfile.settings?.model || 'Модель не выбрана' }}</span>
      </div>
      <div class="token-usage">
        <span class="token-count">{{ formatTokens(tokenUsage.total_tokens) }} <span v-if="maxTokens > 0">/ {{ formatTokens(maxTokens) }}</span></span>
        <div v-if="maxTokens > 0" class="token-progress-wrapper">
          <div class="token-progress" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <!-- КНОПКА ИНДЕКСАЦИИ ЛОРА -->
      <button 
        class="action-pill-btn" 
        :title="isIndexing ? 'Индексация лора...' : 'Переиндексировать главы и энциклопедию для векторного Auto-RAG поиска'"
        :disabled="isIndexing"
        @click="handleReindexLore"
      >
        <i class="fas" :class="isIndexing ? 'fa-spinner fa-spin' : 'fa-brain'"></i>
        <span>{{ isIndexing ? 'Индексация...' : 'Индекс лора' }}</span>
      </button>

      <!-- КНОПКА ПЕРЕЗАПУСКА СЕССИИ / СБРОСА -->
      <button 
        class="action-pill-btn restart-btn" 
        title="Перезапустить или отменить зависший запрос к ИИ"
        @click="$emit('restart-session')"
      >
        <i class="fas fa-redo-alt"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { AiProfile } from '../types/ai.types';
import { useAiModels } from '../composables/useAiModels';

export interface AiTopBarMode {
  slug: string;
  name: string;
  icon?: string;
  [key: string]: unknown;
}

const props = withDefaults(defineProps<{
  activeProfile?: AiProfile | null;
  tokenUsage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  modes?: AiTopBarMode[];
  activeModeSlug?: string;
  currentProject?: string;
}>(), {
  activeProfile: null,
  tokenUsage: () => ({ input_tokens: 0, output_tokens: 0, total_tokens: 0 }),
  modes: () => [],
  activeModeSlug: 'chat',
  currentProject: 'global'
});

defineEmits(['change-mode', 'toggle-sidebar', 'restart-session']);

const isIndexing = ref(false);
const { availableModels, fetchModels } = useAiModels();

const handleReindexLore = async () => {
  if (isIndexing.value) return;
  isIndexing.value = true;
  try {
    const totalChunks = await invoke<number>('reindex_project_lore', { 
      projectId: props.currentProject || 'global' 
    });
    const { appAlert } = await import('@worldwiki/components');
    appAlert(`Лор проекта успешно проиндексирован: создано ${totalChunks} фрагментов.`);
  } catch (e) {
    console.error('Ошибка индексации лора:', e);
    const { appAlert } = await import('@worldwiki/components');
    appAlert(`Ошибка индексации лора: ${e}`);
  } finally {
    isIndexing.value = false;
  }
};

// Автоматически подгружаем список моделей из кэша (или API) при смене профиля
watch(() => props.activeProfile, (profile) => {
  if (profile && profile.provider) {
    fetchModels(profile.provider, profile.api_key || '');
  }
}, { immediate: true });

const maxTokens = computed(() => {
  if (props.activeProfile?.settings?.context_window) {
    return props.activeProfile.settings.context_window;
  }
  if (props.activeProfile?.settings?.model) {
    const modelInfo = availableModels.value.find(m => m.value === props.activeProfile?.settings?.model);
    if (modelInfo && modelInfo.context_length) {
      return modelInfo.context_length;
    }
  }
  return 0;
});

const progressPercent = computed(() => {
  if (maxTokens.value === 0) return 0;
  return Math.min(100, ((props.tokenUsage?.total_tokens || 0) / maxTokens.value) * 100);
});

const formatTokens = (val: number = 0) => {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + ' млн';
  if (val >= 1000) return (val / 1000).toFixed(1) + ' тыс';
  return (val || 0).toString();
};
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiChatTopBar.css"></style>

<style scoped>
.action-pill-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-color, #e6edf3);
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.action-pill-btn:hover:not(:disabled) {
  background: rgba(88, 166, 255, 0.15);
  border-color: #58a6ff;
  color: #fff;
}
.action-pill-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.restart-btn {
  padding: 4px 8px;
}
.restart-btn:hover {
  background: rgba(248, 81, 73, 0.15);
  border-color: #f85149;
  color: #f85149;
}
</style>
