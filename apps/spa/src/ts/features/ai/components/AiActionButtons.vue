<template>
  <div v-if="isVisible" class="ai-action-buttons">
    <button v-if="isGenerating" class="action-btn cancel" title="Остановить генерацию" @click="handleCancel">
      <i class="fas fa-stop-circle"></i> Отменить
    </button>
    <button v-if="isGenerating || hasError" class="action-btn unload" title="Экстренно выгрузить модели из видеопамяти GPU" @click="handleUnloadModels">
      <i class="fas fa-memory"></i> Сброс памяти GPU
    </button>
    <button v-if="!isGenerating && hasError" class="action-btn retry" @click="handleRetry">
      <i class="fas fa-redo"></i> Повторить
    </button>
    <button v-if="!isGenerating && canResume" class="action-btn resume" @click="handleResume">
      <i class="fas fa-play"></i> Продолжить задачу
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AiActionButtonsProps, AiActionButtonsEmits } from './AiActionButtons.model';
import { useAiActionButtons } from './useAiActionButtons';

const props = withDefaults(defineProps<AiActionButtonsProps>(), {
  isGenerating: false,
  hasError: false,
  canResume: false
});

const emit = defineEmits<AiActionButtonsEmits>();

const { isVisible, handleCancel, handleUnloadModels, handleRetry, handleResume } = useAiActionButtons(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiActionButtons.css"></style>
