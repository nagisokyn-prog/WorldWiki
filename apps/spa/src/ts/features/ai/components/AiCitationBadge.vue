<template>
  <span class="ai-citation-wrapper">
    <button
      ref="badgeRef"
      class="ai-citation-badge"
      :title="`${citation.title} (${citation.domain})`"
      @click="togglePopover"
    >
      [{{ citation.index }}]
    </button>
    <AiCitationPopover
      :citation="citation"
      :is-open="isPopoverOpen"
      :anchor-el="badgeRef"
      @close="isPopoverOpen = false"
      @ask-source="onAskSource"
    />
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { AiCitationBadgeProps, CitationItem } from './AiCitation.model';
import AiCitationPopover from './AiCitationPopover.vue';

const props = defineProps<AiCitationBadgeProps>();
const emit = defineEmits<{
  (e: 'ask-source', citation: CitationItem): void;
}>();

const badgeRef = ref<HTMLElement | null>(null);
const isPopoverOpen = ref(false);

const togglePopover = () => {
  isPopoverOpen.value = !isPopoverOpen.value;
};

const onAskSource = (item: CitationItem) => {
  emit('ask-source', item);
  isPopoverOpen.value = false;
};
</script>

<style scoped>
.ai-citation-wrapper {
  display: inline-block;
  vertical-align: baseline;
  position: relative;
  margin: 0 2px;
}

.ai-citation-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  padding: 1px 4px;
  background: var(--color-bg-secondary);
  color: var(--color-accent-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.ai-citation-badge:hover {
  background: var(--color-accent-primary);
  color: var(--color-text-on-accent);
  transform: translateY(-1px);
}
</style>
