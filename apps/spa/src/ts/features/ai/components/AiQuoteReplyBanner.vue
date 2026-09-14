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
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  margin-bottom: 2px;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.banner-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 14px;
}

.banner-content {
  flex: 1;
  min-width: 0;
}

.banner-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 2px;
}

.banner-text {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
}

.banner-close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  transition: all var(--anim-speed-fast) ease;
  font-size: 12px;
}

.banner-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}
</style>
