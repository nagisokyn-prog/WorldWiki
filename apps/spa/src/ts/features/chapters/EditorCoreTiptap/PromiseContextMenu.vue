<template>
  <div
    v-if="isOpen"
    ref="menuRef"
    class="promise-context-menu"
    :style="{ top: `${adjustedPos.y}px`, left: `${adjustedPos.x}px` }"
    @click.stop
  >
    <!-- Header with tab switch if existing promises exist -->
    <div class="promise-menu-header">
      <span class="header-icon">🎯</span>
      <span class="header-title">Сюжетное обещание</span>
    </div>

    <!-- Mode Tabs: Создать новое / Привязать к существующему -->
    <div v-if="activeExistingPromises.length > 0" class="menu-tabs">
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'create' }"
        @click="currentTab = 'create'"
      >
        ✨ Создать
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'link' }"
        @click="currentTab = 'link'"
      >
        🔗 Привязать ({{ activeExistingPromises.length }})
      </button>
    </div>

    <!-- TAB 1: CREATE NEW PROMISE -->
    <div v-if="currentTab === 'create'" class="promise-menu-items">
      <div
        v-for="(item, idx) in promiseTypes"
        :key="item.kind"
        class="promise-menu-item"
        :class="{ active: selectedIndex === idx }"
        @click="selectItem(item)"
        @mouseenter="selectedIndex = idx"
      >
        <span class="item-icon">{{ item.icon }}</span>
        <div class="item-content">
          <div class="item-label">{{ item.label }}</div>
          <div class="item-desc">{{ item.description }}</div>
        </div>
      </div>
    </div>

    <!-- TAB 2: LINK TO EXISTING PROMISE (Progress or Resolve) -->
    <div v-else-if="currentTab === 'link'" class="existing-promises-list">
      <div 
        v-for="p in activeExistingPromises" 
        :key="p.id || p.quote"
        class="existing-promise-card"
      >
        <div class="existing-promise-info">
          <span class="promise-kind-badge">{{ getKindIcon(p.kind) }} {{ getKindLabel(p.kind) }}</span>
          <div class="promise-quote-preview">«{{ p.quote }}»</div>
        </div>
        
        <div class="milestone-action-buttons">
          <button 
            class="btn-milestone btn-progress" 
            title="Добавить как этап развития / напоминания"
            @click="selectMilestone(p, 'progression')"
          >
            🌿 Развить
          </button>
          <button 
            class="btn-milestone btn-resolve" 
            title="Отметить как развязку / выстрел ружья"
            @click="selectMilestone(p, 'resolution')"
          >
            🎯 Отстрелять
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { PlotPromise } from '@/types/generated/PlotPromise';

export interface PromiseTypeOption {
  kind: string;
  label: string;
  icon: string;
  description: string;
}

const promiseTypes: PromiseTypeOption[] = [
  {
    kind: 'gun',
    label: 'Чеховское ружьё',
    icon: '🔫',
    description: 'Деталь или предмет, который обязан выстрелить'
  },
  {
    kind: 'foreshadowing',
    label: 'Предзнаменование',
    icon: '🔮',
    description: 'Намёк или предвестие будущего события'
  },
  {
    kind: 'mystery',
    label: 'Тайна',
    icon: '🗝️',
    description: 'Скрытая загадка или тайна мира/персонажа'
  },
  {
    kind: 'question',
    label: 'Нераскрытый вопрос',
    icon: '❓',
    description: 'Открытый вопрос или сюжетная зацепка'
  }
];

const props = defineProps<{
  isOpen: boolean;
  position: { x: number; y: number };
  existingPromises?: PlotPromise[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', item: PromiseTypeOption): void;
  (e: 'link-milestone', payload: { promise: PlotPromise; stage: 'progression' | 'resolution' }): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const selectedIndex = ref(0);
const currentTab = ref<'create' | 'link'>('create');
const adjustedPos = ref({ x: 0, y: 0 });

const activeExistingPromises = computed(() => {
  return (props.existingPromises || []).filter((p) => p.status !== 'resolved');
});

const getKindIcon = (kind: string) => {
  return promiseTypes.find((t) => t.kind === kind)?.icon || '📌';
};

const getKindLabel = (kind: string) => {
  return promiseTypes.find((t) => t.kind === kind)?.label || 'Обещание';
};

const selectItem = (item: PromiseTypeOption) => {
  emit('select', item);
  emit('close');
};

const selectMilestone = (promise: PlotPromise, stage: 'progression' | 'resolution') => {
  emit('link-milestone', { promise, stage });
  emit('close');
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (currentTab.value === 'create') {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex.value = (selectedIndex.value + 1) % promiseTypes.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex.value = (selectedIndex.value - 1 + promiseTypes.length) % promiseTypes.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectItem(promiseTypes[selectedIndex.value]);
    }
  }
};

const handleClickOutside = (e: MouseEvent) => {
  if (props.isOpen && menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close');
  }
};

watch(() => props.isOpen, (open) => {
  if (open) {
    selectedIndex.value = 0;
    currentTab.value = 'create';
    adjustedPos.value = { ...props.position };
    nextTick(() => {
      if (menuRef.value) {
        const rect = menuRef.value.getBoundingClientRect();
        let x = props.position.x;
        let y = props.position.y;
        if (x + rect.width > window.innerWidth - 16) {
          x = window.innerWidth - rect.width - 16;
        }
        if (y + rect.height > window.innerHeight - 16) {
          y = window.innerHeight - rect.height - 16;
        }
        adjustedPos.value = { x: Math.max(16, x), y: Math.max(16, y) };
      }
    });
  }
});

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<style scoped>
.promise-context-menu {
  position: fixed;
  z-index: 10000;
  width: 320px;
  max-width: 90vw;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  backdrop-filter: blur(var(--glass-blur, 16px));
  -webkit-backdrop-filter: blur(var(--glass-blur, 16px));
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: menuAppear 0.12s ease-out forwards;
}

@keyframes menuAppear {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.promise-menu-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-color);
}

.header-icon {
  font-size: 14px;
}

.header-title {
  font-size: var(--font-size-xs, 11px);
  font-weight: var(--font-weight-bold, 700);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent);
}

.menu-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-input);
  padding: 2px;
  border-radius: var(--radius-xs, 4px);
  margin-bottom: 4px;
}

.tab-btn {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: var(--font-size-xs, 11px);
  padding: 3px 6px;
  border-radius: var(--radius-xs, 3px);
  cursor: pointer;
  transition: all var(--anim-speed-fast, 0.12s) ease;
  font-family: inherit;
}

.tab-btn:hover {
  color: var(--text-main);
}

.tab-btn.active {
  background: var(--accent);
  color: #fff;
  font-weight: 500;
}

.promise-menu-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.promise-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: var(--radius-xs, 6px);
  cursor: pointer;
  transition: all var(--anim-speed-fast, 0.12s) ease;
  user-select: none;
}

.promise-menu-item:hover,
.promise-menu-item.active {
  background: var(--bg-selected);
  box-shadow: 0 0 0 1px var(--border-active) inset;
}

.item-icon {
  font-size: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
}

.item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-label {
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-main);
}

.item-desc {
  font-size: var(--font-size-xs, 11px);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.existing-promises-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
  padding: 2px;
}

.existing-promises-list::-webkit-scrollbar {
  width: 4px;
}
.existing-promises-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.existing-promise-card {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs, 6px);
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.existing-promise-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.promise-kind-badge {
  font-size: 10px;
  color: var(--accent-light);
  font-weight: 600;
}

.promise-quote-preview {
  font-size: var(--font-size-xs, 11px);
  color: var(--text-main);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.milestone-action-buttons {
  display: flex;
  gap: 6px;
}

.btn-milestone {
  flex: 1;
  font-size: 10px;
  font-weight: 500;
  padding: 3px 6px;
  border-radius: var(--radius-xs, 4px);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--anim-speed-fast, 0.12s) ease;
  font-family: inherit;
}

.btn-progress {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning, #f59e0b);
  border-color: rgba(245, 158, 11, 0.3);
}
.btn-progress:hover {
  background: var(--warning, #f59e0b);
  color: #000;
}

.btn-resolve {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success, #10b981);
  border-color: rgba(16, 185, 129, 0.3);
}
.btn-resolve:hover {
  background: var(--success, #10b981);
  color: #fff;
}
</style>
