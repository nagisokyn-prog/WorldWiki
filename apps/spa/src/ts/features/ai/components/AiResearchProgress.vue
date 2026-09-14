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

<style scoped src="@worldwiki/resources/styles/features/ai/AiResearchProgress.css"></style>
