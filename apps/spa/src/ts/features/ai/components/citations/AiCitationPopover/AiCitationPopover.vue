<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="popoverRef"
      class="ai-citation-popover"
      :style="popoverStyle"
      @click.stop
    >
      <div class="popover-header">
        <span class="source-domain">🌐 {{ citation.domain }}</span>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <div class="popover-title">
        <a :href="citation.url" target="_blank" rel="noopener noreferrer">
          {{ citation.title }} ↗
        </a>
      </div>

      <div class="popover-excerpt">
        «{{ citation.excerpt }}»
      </div>

      <div class="popover-actions">
        <button class="action-btn ask-wowilon" @click="askSource">
          ⚡ Спросить WoWiLon об этом источнике
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useAiCitationPopover } from './useAiCitationPopover';
import type { AiCitationPopoverProps, AiCitationPopoverEmits } from '../AiCitation.model';

const props = defineProps<AiCitationPopoverProps>();
const emit = defineEmits<AiCitationPopoverEmits>();

const { popoverRef, popoverStyle, close, askSource } = useAiCitationPopover(props, emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiCitationPopover.css"></style>
