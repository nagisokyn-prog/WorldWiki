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

<style scoped src="@worldwiki/resources/styles/features/chapters/PromiseContextMenu.css"></style>

