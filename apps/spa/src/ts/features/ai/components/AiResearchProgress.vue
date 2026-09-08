<template>
  <div v-if="stage && stage !== 'idle'" class="ai-research-progress">
    <div class="progress-status">
      <span class="spinner-icon">🔄</span>
      <span class="stage-label">{{ stageLabel }}</span>
    </div>

    <div class="metrics-row">
      <span v-if="hitsCount !== undefined" class="metric-badge">
        🔎 Найдено кандидатов: <strong>{{ hitsCount }}</strong>
      </span>
      <span v-if="pagesCount !== undefined" class="metric-badge">
        📖 Прочитано страниц: <strong>{{ pagesCount }}</strong>
      </span>
      <span v-if="evidenceCount !== undefined" class="metric-badge">
        🧩 Доказательств: <strong>{{ evidenceCount }}</strong>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AiResearchProgressProps } from './AiResearchProgress.model';

const props = withDefaults(defineProps<AiResearchProgressProps>(), {
  stage: 'idle',
  hitsCount: 0,
  pagesCount: 0,
  evidenceCount: 0,
});

const stageLabel = computed(() => {
  switch (props.stage) {
    case 'planning':
      return 'Формирование плана исследования...';
    case 'searching':
      return props.query ? `Поиск: «${props.query}»` : 'Поиск источников...';
    case 'reading':
      return 'Чтение и анализ страниц...';
    case 'synthesizing':
      return 'Синтез ответа и проверка цитат...';
    case 'completed':
      return 'Исследование завершено';
    default:
      return '';
  }
});
</script>

<style scoped>
.ai-research-progress {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 6px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  background: var(--color-bg-secondary);
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius-md, 6px);
  margin-bottom: var(--spacing-sm, 8px);
  animation: fadeIn 0.2s ease-in-out;
}

.progress-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 6px);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.spinner-icon {
  display: inline-block;
  animation: spin 1.5s linear infinite;
}

.metrics-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs, 6px);
}

.metric-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border-radius: var(--border-radius-sm, 4px);
}

.metric-badge strong {
  color: var(--color-accent-primary, #3b82f6);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
