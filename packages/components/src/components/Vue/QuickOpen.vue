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
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <span class="qo-item-title" v-html="highlight(item.title)"></span>
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
import { ref, watch, nextTick, computed } from 'vue';

/**
 * QuickOpen — tauri-surreal-kit
 *
 * Domain-agnostic quick-open palette (VS Code Ctrl+P).
 *
 * Provide items via the `dataSource` prop — an async function that returns
 * QOItem[]. The caller is responsible for loading entities, chapters, etc.
 *
 * Example:
 *   <QuickOpen
 *     :dataSource="async () => [...entities, ...chapters]"
 *     @select="handleSelect"
 *   />
 */

export interface QOItem {
  id: string;
  rawId: string;
  title: string;
  typeLabel: string;
  /** Arbitrary type discriminator — use whatever makes sense in your domain. */
  entityType: string;
  emoji: string;
  data?: unknown;
}

const props = defineProps<{
  /** Async function that returns all searchable items. Called once on first open. */
  dataSource: () => Promise<QOItem[]>;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'select', item: QOItem): void;
}>();

const isOpen   = ref(false);
const query    = ref('');
const loading  = ref(false);
const activeIdx = ref(0);
const inputRef  = ref<HTMLInputElement | null>(null);
const resultsRef = ref<HTMLElement | null>(null);
const allItems  = ref<QOItem[]>([]);
const placeholder = props.placeholder ?? 'Type to search...';

const filtered = computed(() => {
  if (!query.value.trim()) return [];
  const q = query.value.toLowerCase();
  return allItems.value.filter(i => i.title.toLowerCase().includes(q));
});

const highlight = (title: string) => {
  if (!query.value) return title;
  const q = query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return title.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
};

const loadAll = async () => {
  if (allItems.value.length > 0) return;
  loading.value = true;
  try {
    allItems.value = await props.dataSource();
  } catch (e) {
    console.error('[QuickOpen] dataSource error:', e);
  }
  loading.value = false;
};

// Invalidate cache when dataSource changes
watch(() => props.dataSource, () => { allItems.value = []; });

const open = async () => {
  isOpen.value = true;
  query.value  = '';
  activeIdx.value = 0;
  await loadAll();
  await nextTick();
  inputRef.value?.focus();
};

const close = () => { isOpen.value = false; };

const moveDown = () => {
  activeIdx.value = Math.min(activeIdx.value + 1, Math.min(filtered.value.length - 1, 19));
  scrollToActive();
};
const moveUp = () => {
  activeIdx.value = Math.max(activeIdx.value - 1, 0);
  scrollToActive();
};
const scrollToActive = () => {
  nextTick(() => {
    resultsRef.value?.querySelectorAll('.qo-item')[activeIdx.value]?.scrollIntoView({ block: 'nearest' });
  });
};

const select = (item: QOItem) => {
  close();
  emit('select', item);
};
const selectActive = () => {
  const item = filtered.value[activeIdx.value];
  if (item) select(item);
};

watch(query, () => { activeIdx.value = 0; });
defineExpose({ open, close, invalidate: () => { allItems.value = []; } });
</script>

<style scoped src="@worldwiki/resources/styles/components/QuickOpen.css"></style>
