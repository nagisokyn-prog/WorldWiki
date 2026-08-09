<template>
  <div v-if="model" class="model-info-card">
    <p v-if="model.description" class="model-desc">{{ model.description }}</p>
    
    <div class="model-stats">
      <div v-if="model.context_length" class="stat-row">
        <span class="stat-label">Контекстное окно:</span>
        <span class="stat-value">{{ formatNumber(model.context_length) }} tokens</span>
      </div>
      <div v-if="model.max_completion_tokens" class="stat-row">
        <span class="stat-label">Максимум вывода:</span>
        <span class="stat-value">{{ formatNumber(model.max_completion_tokens) }} tokens</span>
      </div>
      
      <div v-if="model.capabilities" class="capabilities-list">
        <div class="stat-row">
          <i class="fas" :class="model.capabilities.vision ? 'fa-check success' : 'fa-times error'"></i>
          <span class="stat-value">{{ model.capabilities.vision ? 'Поддерживает изображения' : 'Не поддерживает изображения' }}</span>
        </div>
        <div class="stat-row">
          <i class="fas" :class="model.capabilities.caching ? 'fa-check success' : 'fa-times error'"></i>
          <span class="stat-value">{{ model.capabilities.caching ? 'Поддерживает кэширование подсказок' : 'Не поддерживает кэширование подсказок' }}</span>
        </div>
      </div>
      
      <div v-if="model.pricing" class="pricing-list">
        <div class="stat-row">
          <span class="stat-label">Цена за вход:</span>
          <span class="stat-value">${{ formatPricing(model.pricing.prompt) }} / 1M tokens</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Цена за вывод:</span>
          <span class="stat-value">${{ formatPricing(model.pricing.completion) }} / 1M tokens</span>
        </div>
      </div>
    </div>
    
    <p class="model-hint">
      Подтягивается автоматически. Если не уверены, что выбрать, Roo Code лучше всего работает с 
      <a href="#" @click.prevent="$emit('recommend', 'anthropic/claude-3-5-sonnet-20241022')">anthropic/claude-3-5-sonnet-20241022</a>.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AiModelInfo } from '../../types/ai.types';

const props = defineProps<{
  model: AiModelInfo | null;
}>();

defineEmits(['recommend']);

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('ru-RU').format(num);
};

const formatPricing = (priceStr: string) => {
  // priceStr is typically price per token as string, e.g. "0.00001"
  // We want to show price per 1M tokens
  const price = parseFloat(priceStr);
  if (isNaN(price)) return '0.00';
  const perMillion = price * 1000000;
  return perMillion.toFixed(2);
};
</script>

<style scoped>
.model-info-card {
  margin-top: 8px;
  padding: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.model-desc {
  margin-bottom: 12px;
  line-height: 1.4;
  color: var(--text-main);
}

.model-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-weight: 500;
  color: var(--text-main);
}

.capabilities-list {
  margin: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pricing-list {
  margin: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.success {
  color: var(--success);
}

.error {
  color: var(--error);
}

.model-hint {
  font-size: 12px;
  margin-top: 8px;
  border-top: 1px solid var(--border-color);
  padding-top: 8px;
}

.model-hint a {
  color: var(--accent);
  text-decoration: none;
}
.model-hint a:hover {
  text-decoration: underline;
}
</style>
