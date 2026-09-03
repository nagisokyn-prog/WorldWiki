import { ref, computed, watch, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { AiModelInfo, AiProfile, AiProfileSettings, InstalledModelInfo } from '../../types/ai.types';

export interface AiSettingsModelsTabProps {
  activeProfile: AiProfile | null;
  availableModels: AiModelInfo[];
  isFetchingModels: boolean;
  fetchError: string | null;
}

export interface AiSettingsModelsTabEmits {
  (e: 'save-profile', payload: { settings: AiProfileSettings }): void;
  (e: 'fetch-models', force: boolean): void;
}

export const standardEmbedOptions = [
  '',
  'nvidia/nemotron-3-embed',
  'openai/text-embedding-3-small',
  'openai/text-embedding-3-large',
];

export function useAiSettingsModelsTab(
  props: AiSettingsModelsTabProps,
  emit: AiSettingsModelsTabEmits
) {
  const localSettings = ref<AiProfileSettings | null>(null);
  const installedModels = ref<InstalledModelInfo[]>([]);
  const customEmbedInput = ref('');

  const isCustomEmbedPath = computed(() => {
    if (!localSettings.value?.embed_model_path) return false;
    if (localSettings.value.embed_model_path === 'custom') return true;
    const inInstalled = installedModels.value.some((m: InstalledModelInfo) => m.filename === localSettings.value?.embed_model_path);
    const inStandard = standardEmbedOptions.includes(localSettings.value.embed_model_path);
    return !inInstalled && !inStandard;
  });

  const loadInstalledModels = async () => {
    try {
      const list = await invoke<InstalledModelInfo[]>('list_installed_models');
      installedModels.value = list || [];
    } catch (e) {
      console.error('Ошибка загрузки локальных моделей:', e);
    }
  };

  onMounted(async () => {
    await loadInstalledModels();
  });

  watch(() => props.activeProfile?.settings, (newSettings) => {
    if (newSettings) {
      localSettings.value = { ...newSettings };
      if (isCustomEmbedPath.value) {
        customEmbedInput.value = localSettings.value.embed_model_path || '';
      }
    } else {
      localSettings.value = null;
    }
  }, { immediate: true, deep: true });

  const onCustomEmbedInput = () => {
    if (localSettings.value) {
      localSettings.value.embed_model_path = customEmbedInput.value;
    }
  };

  const handleSave = () => {
    if (localSettings.value) {
      if (localSettings.value.embed_model_path === 'custom') {
        localSettings.value.embed_model_path = customEmbedInput.value;
      }
      emit('save-profile', { settings: localSettings.value });
    }
  };

  const availableModelOptions = computed(() => {
    return props.availableModels.map((m: AiModelInfo) => ({
      value: m.value,
      label: m.label,
      description: m.description,
    }));
  });

  return {
    localSettings,
    installedModels,
    customEmbedInput,
    isCustomEmbedPath,
    availableModelOptions,
    onCustomEmbedInput,
    handleSave
  };
}
