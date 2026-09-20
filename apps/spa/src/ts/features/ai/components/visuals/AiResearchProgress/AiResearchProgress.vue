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
import type { AiResearchProgressProps } from './AiResearchProgress.model';
import { useAiResearchProgress } from './useAiResearchProgress';

const props = withDefaults(defineProps<AiResearchProgressProps>(), {
  stage: 'idle',
  hitsCount: 0,
  pagesCount: 0,
  evidenceCount: 0,
});

const { stageLabel } = useAiResearchProgress(props);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiResearchProgress.css"></style>
