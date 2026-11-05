import { ref, watch, computed } from 'vue';
import type { AiProfile } from '@/features/ai/types/ai.types';

export interface AiSettingsConnectionsTabProps {
  profiles: AiProfile[];
  activeProfile: AiProfile | null;
}

export interface AiSettingsConnectionsTabEmits {
  (e: 'select-profile', id: string): void;
  (e: 'create-profile'): void;
  (e: 'delete-profile'): void;
  (e: 'save-profile', profile: AiProfile | null): void;
  (e: 'provider-changed', provider: string): void;
}

export function useAiSettingsConnectionsTab(
  props: AiSettingsConnectionsTabProps,
  emit: AiSettingsConnectionsTabEmits
) {
  const showApiKey = ref(false);
  const localProfile = ref<AiProfile | null>(null);

  watch(() => props.activeProfile, (newVal) => {
    if (newVal) {
      localProfile.value = { ...newVal };
    } else {
      localProfile.value = null;
    }
  }, { immediate: true, deep: true });

  const handleSave = () => {
    emit('save-profile', localProfile.value);
  };

  const getProviderLabel = (provider: string) => {
    const map: Record<string, string> = {
      openrouter: 'OpenRouter',
      anthropic: 'Anthropic',
      openai: 'OpenAI',
      gemini: 'Google Gemini',
      deepseek: 'DeepSeek',
      local: 'Локальный инференс',
      ollama: 'Ollama',
    };
    return map[provider] || provider;
  };

  const getDefaultUrl = (provider: string) => {
    const map: Record<string, string> = {
      openrouter: 'https://openrouter.ai/api/v1',
      anthropic: 'https://api.anthropic.com',
      openai: 'https://api.openai.com/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
      deepseek: 'https://api.deepseek.com/v1',
      local: 'http://localhost:8080/v1',
      ollama: 'http://localhost:11434/v1',
    };
    return map[provider] || 'https://api.openai.com/v1';
  };

  const profilesWithLabels = computed(() => {
    return props.profiles.map((p) => ({
      ...p,
      providerLabel: getProviderLabel(p.provider)
    }));
  });

  return {
    showApiKey,
    localProfile,
    handleSave,
    getProviderLabel,
    getDefaultUrl,
    profilesWithLabels,
  };
}
