import { ref, watch } from 'vue';
import type { AiProfileSettings } from '../../../types/ai.types';

export interface LocalAiRuntimeProps {
  localSettings: AiProfileSettings | null;
}

export interface LocalAiRuntimeEmits {
  (e: 'save-runtime', settings: AiProfileSettings): void;
}

export function useLocalAiRuntime(
  props: LocalAiRuntimeProps,
  emit: LocalAiRuntimeEmits
) {
  const runtimeSettings = ref<AiProfileSettings | null>(null);

  watch(() => props.localSettings, (val) => {
    if (val) {
      runtimeSettings.value = { ...val };
    } else {
      runtimeSettings.value = null;
    }
  }, { immediate: true, deep: true });

  const handleSave = () => {
    if (runtimeSettings.value) {
      emit('save-runtime', runtimeSettings.value);
    }
  };

  return {
    runtimeSettings,
    handleSave
  };
}
