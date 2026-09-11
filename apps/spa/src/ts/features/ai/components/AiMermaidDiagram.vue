<template>
  <div class="ai-mermaid-wrapper">
    <div class="mermaid-toolbar">
      <div class="mermaid-title">
        <i class="fas fa-project-diagram"></i>
        <span>Mermaid Диаграмма</span>
      </div>
      <div class="mermaid-actions">
        <button class="mermaid-btn" :title="showRaw ? 'Показать диаграмму' : 'Показать исходный код'" @click="toggleRaw">
          <i :class="showRaw ? 'fas fa-eye' : 'fas fa-code'"></i>
          {{ showRaw ? 'Схема' : 'Код' }}
        </button>
        <button class="mermaid-btn" title="Копировать код диаграммы" @click="copyCode">
          <i :class="isCopied ? 'fas fa-check' : 'fas fa-copy'"></i>
          {{ isCopied ? 'Скопировано' : 'Копировать' }}
        </button>
      </div>
    </div>

    <div v-if="showRaw" class="mermaid-raw-code">
      <pre>{{ code }}</pre>
    </div>

    <div v-else class="mermaid-viewport">
      <div v-if="isLoading" class="mermaid-loading">
        <i class="fas fa-spinner fa-spin"></i> Построение диаграммы...
      </div>
      <div v-else-if="errorMessage" class="mermaid-error">
        <p>Не удалось построить диаграмму:</p>
        <code>{{ errorMessage }}</code>
      </div>
      <div v-show="!isLoading && !errorMessage" ref="containerRef" class="mermaid-svg-container"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiMermaidDiagramProps, AiMermaidDiagramEmits } from './AiMermaidDiagram.model';
import { useAiMermaidDiagram } from './useAiMermaidDiagram';

const props = defineProps<AiMermaidDiagramProps>();
const emit = defineEmits<AiMermaidDiagramEmits>();

const {
  containerRef,
  isLoading,
  errorMessage,
  showRaw,
  isCopied,
  copyCode,
  toggleRaw
} = useAiMermaidDiagram(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiMermaidDiagram.css"></style>
