<template>
  <div v-if="quotedText" class="ai-quote-reply-banner">
    <div class="banner-indicator">
      <span class="banner-icon">⚡</span>
    </div>
    <div class="banner-content">
      <div class="banner-title">Ответ по выделенному фрагменту:</div>
      <div class="banner-text">«{{ quotedText }}»</div>
    </div>
    <button class="banner-close-btn" title="Открепить фрагмент" @click="onClear">
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AiQuoteReplyBannerProps, AiQuoteReplyBannerEmits } from './AiQuoteReplyBanner.model';
import { useAiQuoteReplyBanner } from './useAiQuoteReplyBanner';

defineProps<AiQuoteReplyBannerProps>();
const emit = defineEmits<AiQuoteReplyBannerEmits>();

const { onClear } = useAiQuoteReplyBanner(emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiQuoteReplyBanner.css"></style>
