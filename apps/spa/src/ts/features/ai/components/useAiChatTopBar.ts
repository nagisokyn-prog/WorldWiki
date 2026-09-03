import { ref, computed, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { AiProfile } from '../types/ai.types';
import { useAiModels } from '../hooks/useAiModels';

export interface AiTopBarMode {
  slug: string;
  name: string;
  icon?: string;
  [key: string]: unknown;
}

export interface AiChatTopBarProps {
  activeProfile?: AiProfile | null;
  tokenUsage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  modes?: AiTopBarMode[];
  activeModeSlug?: string;
  currentProject?: string;
}

export function useAiChatTopBar(props: AiChatTopBarProps) {
  const isIndexing = ref(false);
  const isUnloading = ref(false);
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

  watch(() => props.activeProfile, (profile) => {
    if (profile && profile.provider) {
      void fetchModels(profile.provider, profile.api_key || '');
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

  const handleUnloadAll = async () => {
    if (isUnloading.value) return;
    isUnloading.value = true;
    try {
      await invoke('cancel_generation').catch(() => {});
      await invoke('unload_all_local_models');
    } catch (err) {
      console.error('Failed to unload models:', err);
    } finally {
      isUnloading.value = false;
    }
  };

  const formatTokens = (val: number = 0) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + ' млн';
    if (val >= 1000) return (val / 1000).toFixed(1) + ' тыс';
    return (val || 0).toString();
  };

  return {
    isIndexing,
    isUnloading,
    maxTokens,
    progressPercent,
    handleReindexLore,
    handleUnloadAll,
    formatTokens
  };
}
