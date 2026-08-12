<template>
  <div class="ai-chat-top-bar" v-if="activeProfile">
    <div class="top-bar-content">
      <div class="model-name">
        <i class="fas fa-microchip"></i>
        <span>{{ activeProfile.settings?.model || 'Модель не выбрана' }}</span>
      </div>
      <div class="token-usage">
        <span class="token-count">{{ formatTokens(tokenUsage.total_tokens) }} <span v-if="maxTokens > 0">/ {{ formatTokens(maxTokens) }}</span></span>
        <div class="token-progress-wrapper" v-if="maxTokens > 0">
          <div class="token-progress" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>
      <div class="cost-badge" title="Примерная стоимость (в будущем из claw-code)">
        $0.0000
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, type PropType } from 'vue';
import type { AiProfile } from '../types/ai.types';
import { useAiModels } from '../composables/useAiModels';

const props = defineProps({
  activeProfile: {
    type: Object as PropType<AiProfile | null>,
    default: null
  },
  tokenUsage: {
    type: Object,
    default: () => ({ input_tokens: 0, output_tokens: 0, total_tokens: 0 })
  }
});

const { availableModels, fetchModels } = useAiModels();

// Автоматически подгружаем список моделей из кэша (или API) при смене профиля
watch(() => props.activeProfile, (profile) => {
  if (profile && profile.provider) {
    // Вызываем без forceNetwork, чтобы просто достать из кэша
    fetchModels(profile.provider, profile.api_key || '');
  }
}, { immediate: true });

const maxTokens = computed(() => {
  // 1. Приоритет ручным настройкам профиля
  if (props.activeProfile?.settings?.context_window) {
    return props.activeProfile.settings.context_window;
  }
  // 2. Ищем модель в загруженном кэше провайдера
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
  return Math.min(100, (props.tokenUsage.total_tokens / maxTokens.value) * 100);
});

const formatTokens = (val: number) => {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'm';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
  return val.toString();
};
</script>

<style scoped>
.ai-chat-top-bar {
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-muted);
  user-select: none;
}

.top-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.model-name {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.token-usage {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 2;
  justify-content: flex-end;
}

.token-count {
  font-family: monospace;
}

.token-progress-wrapper {
  width: 100px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.token-progress {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.cost-badge {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 10px;
  font-family: monospace;
  font-size: 10px;
  color: var(--text-color);
}
</style>
