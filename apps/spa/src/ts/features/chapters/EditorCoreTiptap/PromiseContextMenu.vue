<template>
  <div
    v-if="isOpen"
    ref="menuRef"
    class="promise-context-menu"
    :style="{ top: `${position.y}px`, left: `${position.x}px` }"
    @click.stop
  >
    <div class="promise-menu-header">
      <span class="header-icon">🎯</span>
      <span class="header-title">Сюжетное обещание</span>
    </div>

    <div class="promise-menu-items">
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';

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
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', item: PromiseTypeOption): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const selectedIndex = ref(0);

const selectItem = (item: PromiseTypeOption) => {
  emit('select', item);
  emit('close');
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % promiseTypes.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value - 1 + promiseTypes.length) % promiseTypes.length;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const item = promiseTypes[selectedIndex.value];
    if (item) selectItem(item);
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
    nextTick(() => {
      // Adjust menu position if overflowing viewport
      if (menuRef.value) {
        const rect = menuRef.value.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          menuRef.value.style.left = `${Math.max(10, window.innerWidth - rect.width - 10)}px`;
        }
        if (rect.bottom > window.innerHeight) {
          menuRef.value.style.top = `${Math.max(10, window.innerHeight - rect.height - 10)}px`;
        }
      }
    });
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('mousedown', handleClickOutside);
});
</script>

<style scoped>
.promise-context-menu {
  position: fixed;
  z-index: 1000;
  width: 280px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 8px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-color);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 6px;
  user-select: none;
  font-family: inherit;
  animation: fadeIn var(--anim-speed-fast, 0.12s) ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.promise-menu-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 8px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 4px;
}

.header-icon {
  font-size: 1rem;
}

.header-title {
  font-size: var(--font-size-xs, 11px);
  font-weight: var(--font-weight-bold, 600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.promise-menu-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.promise-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-xs, 6px);
  cursor: pointer;
  transition: background var(--anim-speed-fast, 0.12s) ease;
}

.promise-menu-item:hover,
.promise-menu-item.active {
  background: var(--bg-selected);
}

.item-icon {
  font-size: 1.15rem;
  line-height: 1;
}

.item-content {
  display: flex;
  flex-direction: column;
}

.item-label {
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-main);
}

.item-desc {
  font-size: var(--font-size-xs, 11px);
  color: var(--text-muted);
  margin-top: 1px;
}
</style>
