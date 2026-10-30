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
      @close="closePopover"
      @ask-source="onAskSource"
    />
  </span>
</template>

<script setup lang="ts">
import type { AiCitationBadgeProps, AiCitationBadgeEmits } from './AiCitationBadge.model';
import { useAiCitationBadge } from './useAiCitationBadge';
import AiCitationPopover from '../AiCitationPopover/AiCitationPopover.vue';

defineProps<AiCitationBadgeProps>();
const emit = defineEmits<AiCitationBadgeEmits>();

const { badgeRef, isPopoverOpen, togglePopover, onAskSource, closePopover } = useAiCitationBadge(emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiCitationBadge.css"></style>
