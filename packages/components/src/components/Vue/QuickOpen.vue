<template>
  <Teleport to="body">
    <Transition name="qo-fade">
      <div v-if="isOpen" class="qo-overlay" @click.self="close">
        <div class="qo-modal" role="dialog" aria-label="Quick Open">
          <!-- Input -->
          <div class="qo-input-wrap">
            <i class="fas fa-search qo-icon"></i>
            <input
              ref="inputRef"
              v-model="query"
              class="qo-input"
              :placeholder="placeholder"
              @keydown.down.prevent="moveDown"
              @keydown.up.prevent="moveUp"
              @keydown.enter.prevent="selectActive"
              @keydown.escape.prevent="close"
            />
            <span class="qo-hint-tag">ESC close</span>
          </div>

          <!-- Results -->
          <div ref="resultsRef" class="qo-results">
            <div v-if="loading" class="qo-loading">
              <i class="fas fa-spinner fa-spin"></i> Searching...
            </div>
            <div v-else-if="filtered.length === 0 && query.length > 0" class="qo-empty">
              Nothing found for «{{ query }}»
            </div>
            <div v-else-if="query.length === 0" class="qo-empty">
              Start typing...
            </div>
            <template v-else>
              <div
                v-for="(item, idx) in filtered.slice(0, 20)"
                :key="item.id"
                class="qo-item"
                :class="{ active: idx === activeIdx }"
                @click="select(item)"
                @mousemove="activeIdx = idx"
              >
                <span class="qo-item-emoji">{{ item.emoji }}</span>
                <div class="qo-item-body">
                  <HighlightText :text="item.title" :query="query" class="qo-item-title" />
                  <span class="qo-item-type">{{ item.typeLabel }}</span>
                </div>
                <kbd v-if="idx === activeIdx" class="qo-enter-hint">↵</kbd>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="qo-footer">
            <span><kbd>↑↓</kbd> navigate</span>
            <span><kbd>↵</kbd> open</span>
            <span><kbd>Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import HighlightText from './HighlightText.vue';
import { 
  useQuickOpen, 
  type QuickOpenProps, 
  type QuickOpenEmits, 
  type QOItem 
} from './useQuickOpen';

export type { QOItem };

const props = defineProps<QuickOpenProps>();
const emit = defineEmits<QuickOpenEmits>();

const {
  isOpen,
  query,
  loading,
  activeIdx,
  inputRef,
  resultsRef,
  placeholder,
  filtered,
  open,
  close,
  moveDown,
  moveUp,
  select,
  selectActive,
  invalidate
} = useQuickOpen(props, emit);

defineExpose({ open, close, invalidate });
</script>

<style scoped src="@worldwiki/resources/styles/components/QuickOpen.css"></style>
