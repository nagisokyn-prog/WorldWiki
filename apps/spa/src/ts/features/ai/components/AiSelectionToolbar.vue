<template>
  <Teleport to="body">
    <div
      v-if="position.visible"
      class="ai-selection-toolbar"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @mousedown.prevent
    >
      <button class="toolbar-btn primary" @click="onAskWoWiLon">
        <span class="icon">⚡</span>
        <span>Спросить WoWiLon</span>
      </button>
      <button class="toolbar-btn" @click="onAddToLore">
        <span class="icon">🏷️</span>
        <span>В лор</span>
      </button>
      <button class="toolbar-btn icon-only" title="Копировать" @click="onCopy">
        <span class="icon">📋</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { AiSelectionToolbarEmits } from './AiSelectionToolbar.model';
import { useAiSelectionToolbar } from './useAiSelectionToolbar';

const emit = defineEmits<AiSelectionToolbarEmits>();
const { position, onAskWoWiLon, onAddToLore, onCopy } = useAiSelectionToolbar(emit);
</script>

<style scoped src="@worldwiki/resources/styles/features/ai/AiSelectionToolbar.css"></style>
