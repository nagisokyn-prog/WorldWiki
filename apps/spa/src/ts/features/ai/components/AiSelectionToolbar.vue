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

<style scoped>
.ai-selection-toolbar {
  position: fixed;
  transform: translate(-50%, -100%);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 6px);
  background: var(--color-bg-secondary);
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius-lg, 8px);
  backdrop-filter: var(--glass-blur);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  z-index: 9999;
  user-select: none;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  padding: 4px 8px;
  background: transparent;
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--border-radius-sm, 4px);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s ease);
}

.toolbar-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-accent-primary, #60a5fa);
}

.toolbar-btn.primary {
  background: var(--color-accent-primary, #3b82f6);
  color: var(--color-text-on-accent, #ffffff);
}

.toolbar-btn.primary:hover {
  filter: brightness(1.1);
}

.toolbar-btn.icon-only {
  padding: 4px 6px;
}
</style>
