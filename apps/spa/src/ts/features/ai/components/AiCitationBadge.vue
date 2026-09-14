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
import type { AiCitationBadgeProps, CitationItem } from './AiCitation.model';
import { useAiCitationBadge } from './useAiCitationBadge';
import AiCitationPopover from './AiCitationPopover.vue';

defineProps<AiCitationBadgeProps>();
const emit = defineEmits<{
  (e: 'ask-source', citation: CitationItem): void;
}>();

const { badgeRef, isPopoverOpen, togglePopover, onAskSource, closePopover } = useAiCitationBadge(emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiCitationBadge.css"></style>
