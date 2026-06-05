<template>
  <Teleport to="body">
    <Transition name="qo-fade">
      <div v-if="isOpen" class="qo-overlay" @click.self="close">
        <div class="qo-modal" role="dialog" aria-label="Быстрое открытие">
          <!-- Input -->
          <div class="qo-input-wrap">
            <i class="fas fa-search qo-icon"></i>
            <input
              ref="inputRef"
              v-model="query"
              class="qo-input"
              placeholder="Введите название сущности или главы..."
              @keydown.down.prevent="moveDown"
              @keydown.up.prevent="moveUp"
              @keydown.enter.prevent="selectActive"
              @keydown.escape.prevent="close"
            />
            <span class="qo-hint-tag">ESC закрыть</span>
          </div>

          <!-- Results -->
          <div class="qo-results" ref="resultsRef">
            <div v-if="loading" class="qo-loading">
              <i class="fas fa-spinner fa-spin"></i> Поиск...
            </div>
            <div v-else-if="filtered.length === 0 && query.length > 0" class="qo-empty">
              Ничего не найдено по «{{ query }}»
            </div>
            <div v-else-if="query.length === 0" class="qo-empty">
              Начните вводить название...
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
                  <span class="qo-item-title" v-html="highlight(item.title)"></span>
                  <span class="qo-item-type">{{ item.typeLabel }}</span>
                </div>
                <kbd class="qo-enter-hint" v-if="idx === activeIdx">↵</kbd>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="qo-footer">
            <span><kbd>↑↓</kbd> навигация</span>
            <span><kbd>↵</kbd> открыть</span>
            <span><kbd>Esc</kbd> закрыть</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { apiService } from '../../services/api.service';

const props = defineProps({
  project: { type: String, required: true },
  sidebarItems: { type: Array as any, default: () => [] }
});

const emit = defineEmits(['open-entity', 'open-chapter']);

const isOpen = ref(false);
const query = ref('');
const loading = ref(false);
const activeIdx = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const resultsRef = ref<HTMLElement | null>(null);

interface QOItem {
  id: string;
  rawId: string;
  title: string;
  typeLabel: string;
  entityType: string;
  tabType: 'entity' | 'chapter';
  emoji: string;
  data?: any;
}

const allItems = ref<QOItem[]>([]);

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
  if (allItems.value.length > 0) return; // already loaded
  loading.value = true;
  const items: QOItem[] = [];

  // Load entities
  const entitySections = (props.sidebarItems as any[]).filter((i: any) => i.type === 'entity');
  for (const sect of entitySections) {
    try {
      const list = await apiService.getEntityList(props.project, sect.entityType);
      for (const e of list as any[]) {
        const title = e.Name || e.name || e.title || e.полное_имя || e.название || `[${String(e.id).substring(0,8)}]`;
        items.push({
          id: `${sect.entityType}:${e.id}`,
          rawId: String(e.id),
          title: String(title).trim(),
          typeLabel: sect.title,
          entityType: sect.entityType,
          tabType: 'entity',
          emoji: sect.emoji || '📄',
          data: e
        });
      }
    } catch (e) { /* skip */ }
  }

  // Load chapters
  try {
    const chapters = await apiService.getChaptersList(props.project);
    for (const ch of chapters as any[]) {
      items.push({
        id: String(ch.id),
        rawId: String(ch.id),
        title: ch.title || `Глава ${ch.id}`,
        typeLabel: 'Глава',
        entityType: 'chapter',
        tabType: 'chapter',
        emoji: '📖',
        data: ch
      });
    }
  } catch (e) { /* skip */ }

  allItems.value = items;
  loading.value = false;
};

const open = async () => {
  isOpen.value = true;
  query.value = '';
  activeIdx.value = 0;
  await loadAll();
  await nextTick();
  inputRef.value?.focus();
};

const close = () => {
  isOpen.value = false;
};

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
    const el = resultsRef.value?.querySelectorAll('.qo-item')[activeIdx.value];
    el?.scrollIntoView({ block: 'nearest' });
  });
};

const select = (item: QOItem) => {
  close();
  if (item.tabType === 'entity') {
    emit('open-entity', { ...item.data, entityType: item.entityType });
  } else {
    emit('open-chapter', item.data);
  }
};

const selectActive = () => {
  const item = filtered.value[activeIdx.value];
  if (item) select(item);
};

// Reset activeIdx on query change
watch(query, () => { activeIdx.value = 0; });

// Горячие клавиши
const handleKeyDown = (e: KeyboardEvent) => {
  if (isOpen.value) return; // Если окно открыто, не обрабатываем
  
  // Ctrl+P - быстрое открытие
  if (e.ctrlKey && e.code === 'KeyP' && !e.altKey && !e.shiftKey) {
    e.preventDefault();
    open();
  }
  
  // Ctrl+Alt+B - правая панель
  if (e.ctrlKey && e.altKey && e.code === 'KeyB' && !e.shiftKey) {
    e.preventDefault();
    const isHidden = localStorage.getItem('chapters-right-panel-visible') === 'false';
    localStorage.setItem('chapters-right-panel-visible', (!isHidden).toString());
    document.dispatchEvent(new CustomEvent('ww:toggle-right-panel'));
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});

// Public API
defineExpose({ open, close });
</script>

<style scoped>
.qo-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
  z-index: 99999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}

.qo-modal {
  width: 640px;
  max-width: 94vw;
  background: var(--bg-panel, #1a1a2e);
  border: 1px solid rgba(139,92,246,0.3);
  border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1) inset;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.qo-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.qo-icon {
  color: rgba(139,92,246,0.7);
  font-size: 14px;
  flex-shrink: 0;
}

.qo-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-main, #fff);
  font-size: 16px;
  font-family: var(--font-family, Inter, sans-serif);
}

.qo-input::placeholder { color: rgba(255,255,255,0.3); }

.qo-hint-tag {
  font-size: 10px;
  color: rgba(255,255,255,0.2);
  white-space: nowrap;
}

.qo-results {
  max-height: 400px;
  overflow-y: auto;
  padding: 6px;
}

.qo-results::-webkit-scrollbar { width: 4px; }
.qo-results::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }

.qo-loading, .qo-empty {
  text-align: center;
  padding: 32px;
  color: rgba(255,255,255,0.3);
  font-size: 14px;
}

.qo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}

.qo-item:hover, .qo-item.active {
  background: rgba(139,92,246,0.12);
}

.qo-item-emoji { font-size: 16px; flex-shrink: 0; width: 24px; text-align: center; }

.qo-item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.qo-item-title {
  font-size: 14px;
  color: var(--text-main, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.qo-item-title mark) {
  background: rgba(139,92,246,0.35);
  color: #c4b5fd;
  border-radius: 2px;
  padding: 0 1px;
}

.qo-item-type {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.qo-enter-hint {
  font-size: 11px;
  padding: 1px 5px;
  background: rgba(139,92,246,0.15);
  border: 1px solid rgba(139,92,246,0.3);
  border-radius: 4px;
  color: #a78bfa;
  flex-shrink: 0;
}

.qo-footer {
  display: flex;
  gap: 20px;
  padding: 8px 18px;
  border-top: 1px solid rgba(255,255,255,0.04);
  font-size: 11px;
  color: rgba(255,255,255,0.25);
}

.qo-footer kbd {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 3px;
  padding: 0 4px;
  font-size: 10px;
  color: rgba(255,255,255,0.4);
}

/* Transitions */
.qo-fade-enter-active, .qo-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.qo-fade-enter-from, .qo-fade-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
