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
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-bg-secondary);
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius-lg);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-md);
  z-index: 9999;
  user-select: none;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 4px 8px;
  background: transparent;
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--border-radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toolbar-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-accent-primary);
}

.toolbar-btn.primary {
  background: var(--color-accent-primary);
  color: var(--color-text-on-accent);
}

.toolbar-btn.primary:hover {
  filter: brightness(1.1);
}

.toolbar-btn.icon-only {
  padding: 4px 6px;
}
</style>
