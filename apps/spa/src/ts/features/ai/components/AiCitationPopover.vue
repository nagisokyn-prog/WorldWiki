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
        <button class="close-btn" @click="emit('close')">✕</button>
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
        <button class="action-btn ask-wowilon" @click="emit('ask-source', citation)">
          ⚡ Спросить WoWiLon об этом источнике
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { AiCitationPopoverProps, AiCitationPopoverEmits } from './AiCitation.model';

const props = defineProps<AiCitationPopoverProps>();
const emit = defineEmits<AiCitationPopoverEmits>();

const popoverRef = ref<HTMLElement | null>(null);

const popoverStyle = computed(() => {
  if (!props.anchorEl) return {};
  const rect = props.anchorEl.getBoundingClientRect();
  return {
    left: `${Math.min(window.innerWidth - 320, Math.max(10, rect.left - 100))}px`,
    top: `${rect.bottom + 8}px`,
  };
});

const handleClickOutside = (e: MouseEvent) => {
  if (props.isOpen && popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
    if (props.anchorEl && props.anchorEl.contains(e.target as Node)) return;
    emit('close');
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.ai-citation-popover {
  position: fixed;
  width: 320px;
  max-width: calc(100vw - 24px);
  padding: var(--spacing-sm);
  background: var(--color-bg-secondary);
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius-lg);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-lg);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.source-domain {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 2px 4px;
}

.popover-title a {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
  text-decoration: none;
  line-height: 1.3;
}

.popover-title a:hover {
  color: var(--color-accent-primary);
  text-decoration: underline;
}

.popover-excerpt {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
  max-height: 100px;
  overflow-y: auto;
  padding: var(--spacing-xs);
  background: var(--color-bg-tertiary);
  border-radius: var(--border-radius-sm);
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.action-btn.ask-wowilon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--color-accent-primary);
  color: var(--color-text-on-accent);
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn.ask-wowilon:hover {
  filter: brightness(1.1);
}
</style>
