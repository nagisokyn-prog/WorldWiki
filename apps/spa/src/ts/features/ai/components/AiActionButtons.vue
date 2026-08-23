<template>
  <div v-if="isVisible" class="ai-action-buttons">
    <button v-if="isGenerating" class="action-btn cancel" title="Остановить генерацию" @click="$emit('cancel')">
      <i class="fas fa-stop-circle"></i> Отменить
    </button>
    <button v-if="isGenerating || hasError" class="action-btn unload" title="Экстренно выгрузить модели из видеопамяти GPU" @click="$emit('unload-models')">
      <i class="fas fa-memory"></i> Сброс памяти GPU
    </button>
    <button v-if="!isGenerating && hasError" class="action-btn retry" @click="$emit('retry')">
      <i class="fas fa-redo"></i> Повторить
    </button>
    <button v-if="!isGenerating && canResume" class="action-btn resume" @click="$emit('resume')">
      <i class="fas fa-play"></i> Продолжить задачу
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  isGenerating?: boolean;
  hasError?: boolean;
  canResume?: boolean;
}>(), {
  isGenerating: false,
  hasError: false,
  canResume: false
});

defineEmits<{
  (e: 'cancel'): void;
  (e: 'unload-models'): void;
  (e: 'retry'): void;
  (e: 'resume'): void;
}>();

const isVisible = computed(() => {
  return props.isGenerating || props.hasError || props.canResume;
});
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiActionButtons.css"></style>
