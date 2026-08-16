<template>
  <div v-if="isVisible" class="ai-action-buttons">
    <button v-if="isGenerating" class="action-btn cancel" @click="$emit('cancel')">
      <i class="fas fa-stop-circle"></i> Отменить
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

const props = defineProps({
  isGenerating: {
    type: Boolean,
    default: false
  },
  hasError: {
    type: Boolean,
    default: false
  },
  canResume: {
    type: Boolean,
    default: false
  }
});

defineEmits(['cancel', 'retry', 'resume']);

const isVisible = computed(() => {
  return props.isGenerating || props.hasError || props.canResume;
});
</script>

<style scoped>
.ai-action-buttons {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-color);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.action-btn.cancel {
  color: var(--danger-color, #ff4d4f);
  border-color: rgba(255, 77, 79, 0.3);
}

.action-btn.cancel:hover {
  background: rgba(255, 77, 79, 0.1);
}

.action-btn.retry {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb, 100, 100, 255), 0.3);
}

.action-btn.resume {
  color: var(--success-color, #52c41a);
  border-color: rgba(82, 196, 26, 0.3);
}
</style>
