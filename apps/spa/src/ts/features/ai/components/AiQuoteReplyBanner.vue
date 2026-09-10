<template>
  <div v-if="quotedText" class="ai-quote-reply-banner">
    <div class="banner-indicator">
      <span class="banner-icon">⚡</span>
    </div>
    <div class="banner-content">
      <div class="banner-title">Ответ по выделенному фрагменту:</div>
      <div class="banner-text">«{{ quotedText }}»</div>
    </div>
    <button class="banner-close-btn" title="Открепить фрагмент" @click="emit('clear')">
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AiQuoteReplyBannerProps, AiQuoteReplyBannerEmits } from './AiQuoteReplyBanner.model';

defineProps<AiQuoteReplyBannerProps>();
const emit = defineEmits<AiQuoteReplyBannerEmits>();
</script>

<style scoped>
.ai-quote-reply-banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-bg-secondary);
  border-left: 3px solid var(--color-accent-primary);
  border-top: 1px solid var(--glass-border);
  border-right: 1px solid var(--glass-border);
  border-top-left-radius: var(--border-radius-md);
  border-top-right-radius: var(--border-radius-md);
}

.banner-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-primary);
}

.banner-content {
  flex: 1;
  min-width: 0;
}

.banner-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent-primary);
}

.banner-text {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banner-close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--border-radius-sm);
  transition: all var(--transition-fast);
}

.banner-close-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}
</style>
