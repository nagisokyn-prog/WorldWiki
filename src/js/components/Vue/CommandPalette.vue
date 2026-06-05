<template>
  <Teleport to="body">
    <Transition name="cp-fade">
      <div v-if="isOpen" class="cp-overlay" @click.self="close">
        <div class="cp-modal" role="dialog" aria-label="Командная панель">
          <!-- Input -->
          <div class="cp-input-wrap">
            <i class="fas fa-terminal cp-icon"></i>
            <input
              ref="inputRef"
              v-model="query"
              class="cp-input"
              placeholder="Введите команду..."
              @keydown.down.prevent="moveDown"
              @keydown.up.prevent="moveUp"
              @keydown.enter.prevent="runActive"
              @keydown.escape.prevent="close"
            />
            <span class="cp-hint-tag">⌘P</span>
          </div>

          <!-- Results -->
          <div class="cp-results" ref="resultsRef">
            <template v-if="filtered.length > 0">
              <div
                v-for="(cmd, idx) in filtered"
                :key="cmd.id"
                class="cp-item"
                :class="{ active: idx === activeIdx }"
                @click="runCmd(cmd)"
                @mousemove="activeIdx = idx"
              >
                <span class="cp-item-icon">{{ cmd.icon }}</span>
                <div class="cp-item-body">
                  <span class="cp-item-title" v-html="highlight(cmd.title)"></span>
                  <span class="cp-item-desc">{{ cmd.desc }}</span>
                </div>
                <kbd v-if="cmd.hotkey" class="cp-kbd">{{ cmd.hotkey }}</kbd>
                <kbd class="cp-enter-hint" v-if="idx === activeIdx">↵</kbd>
              </div>
            </template>
            <div v-else class="cp-empty">Команда не найдена</div>
          </div>

          <!-- Footer -->
          <div class="cp-footer">
            <span><kbd>↑↓</kbd> выбор</span>
            <span><kbd>↵</kbd> выполнить</span>
            <span><kbd>Esc</kbd> закрыть</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';

interface Command {
  id: string;
  title: string;
  desc: string;
  icon: string;
  hotkey?: string;
  action: () => void;
  keywords?: string[];
}

const emit = defineEmits([
  'save-all', 'new-entity', 'new-chapter', 'open-settings',
  'toggle-sidebar', 'toggle-panel', 'close-all-tabs',
  'zoom-in', 'zoom-out', 'zoom-reset', 'open-quick', 'open-tags', 'open-sandbox'
]);

const isOpen = ref(false);
const query = ref('');
const activeIdx = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const resultsRef = ref<HTMLElement | null>(null);

const allCommands = computed<Command[]>(() => [
  {
    id: 'save-all',
    title: 'Сохранить всё',
    desc: 'Сохранить все несохранённые вкладки',
    icon: '💾',
    hotkey: 'Ctrl+S',
    keywords: ['сохранить', 'save'],
    action: () => emit('save-all')
  },
  {
    id: 'new-entity',
    title: 'Создать новую сущность',
    desc: 'Добавить запись текущего типа',
    icon: '✨',
    hotkey: 'Ctrl+N',
    keywords: ['новый', 'создать', 'добавить', 'new'],
    action: () => emit('new-entity')
  },
  {
    id: 'new-chapter',
    title: 'Новая глава',
    desc: 'Создать новую главу в рукописи',
    icon: '📖',
    hotkey: 'Ctrl+Shift+N',
    keywords: ['глава', 'chapter', 'создать'],
    action: () => emit('new-chapter')
  },
  {
    id: 'open-settings',
    title: 'Открыть настройки',
    desc: 'Темы, шрифты, интерфейс',
    icon: '⚙️',
    hotkey: 'Ctrl+,',
    keywords: ['настройки', 'settings', 'тема'],
    action: () => emit('open-settings')
  },
  {
    id: 'open-sandbox',
    title: 'Редактор схем (UI Sandbox)',
    desc: 'Открыть песочницу для редактирования UI шаблонов',
    icon: '🛠️',
    hotkey: 'Ctrl+Shift+U',
    keywords: ['ui', 'sandbox', 'схема', 'шаблон', 'редактор'],
    action: () => { close(); emit('open-sandbox'); }
  },
  {
    id: 'toggle-sidebar',
    title: 'Показать/скрыть сайдбар',
    desc: 'Переключить видимость панели навигации',
    icon: '🗂️',
    hotkey: 'Ctrl+B',
    keywords: ['сайдбар', 'sidebar', 'панель'],
    action: () => emit('toggle-sidebar')
  },
  {
    id: 'toggle-right-panel',
    title: 'Показать/скрыть правую панель',
    desc: 'Переключить видимость инструментов и таймлайна',
    icon: '⚙️',
    hotkey: 'Ctrl+Alt+B',
    keywords: ['правая', 'панель', 'инструменты', 'right panel'],
    action: () => {
      const isHidden = localStorage.getItem('chapters-right-panel-visible') === 'false';
      localStorage.setItem('chapters-right-panel-visible', (!isHidden).toString());
      document.dispatchEvent(new CustomEvent('ww:toggle-right-panel'));
    }
  },
  {
    id: 'toggle-structure',
    title: 'Показать/скрыть структуру (Split View)',
    desc: 'Переключить блоки структуры в режиме Split View',
    icon: '🧩',
    hotkey: 'Ctrl+R',
    keywords: ['структура', 'структурак', 'блоки', 'split'],
    action: () => {
      const isHidden = localStorage.getItem('split-view-show-structure') === 'false';
      localStorage.setItem('split-view-show-structure', (!isHidden).toString());
      document.dispatchEvent(new CustomEvent('ww:toggle-structure'));
    }
  },
  {
    id: 'toggle-panel',
    title: 'Показать/скрыть терминал',
    desc: 'Переключить нижнюю панель',
    icon: '💻',
    hotkey: 'Ctrl+`',
    keywords: ['терминал', 'консоль', 'terminal', 'панель'],
    action: () => emit('toggle-panel')
  },
  {
    id: 'close-all-tabs',
    title: 'Закрыть все вкладки',
    desc: 'Закрыть все открытые редакторы',
    icon: '✖️',
    keywords: ['закрыть', 'вкладки', 'close'],
    action: () => emit('close-all-tabs')
  },
  {
    id: 'zoom-in',
    title: 'Увеличить масштаб',
    desc: 'Zoom in',
    icon: '🔍',
    hotkey: 'Ctrl+=',
    keywords: ['масштаб', 'zoom', 'увеличить'],
    action: () => emit('zoom-in')
  },
  {
    id: 'zoom-out',
    title: 'Уменьшить масштаб',
    desc: 'Zoom out',
    icon: '🔎',
    hotkey: 'Ctrl+-',
    keywords: ['масштаб', 'zoom', 'уменьшить'],
    action: () => emit('zoom-out')
  },
  {
    id: 'zoom-reset',
    title: 'Сбросить масштаб',
    desc: 'Вернуть 100%',
    icon: '⊙',
    hotkey: 'Ctrl+0',
    keywords: ['масштаб', 'zoom', 'сброс', 'reset'],
    action: () => emit('zoom-reset')
  },
  {
    id: 'quick-open',
    title: 'Быстрое открытие',
    desc: 'Найти и открыть сущность или главу',
    icon: '🔎',
    hotkey: 'Ctrl+P',
    keywords: ['открыть', 'найти', 'поиск', 'open', 'search'],
    action: () => { close(); emit('open-quick'); }
  },
  {
    id: 'manage-tags',
    title: 'Управление тегами',
    desc: 'Открыть окно управления тегами проекта',
    icon: '🏷️',
    hotkey: 'Ctrl+Shift+T',
    keywords: ['теги', 'tags', 'управление'],
    action: () => { close(); emit('open-tags'); }
  },
]);

const filtered = computed(() => {
  if (!query.value.trim()) return allCommands.value;
  const q = query.value.toLowerCase();
  return allCommands.value.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.desc.toLowerCase().includes(q) ||
    (c.keywords || []).some(k => k.includes(q))
  );
});

const highlight = (title: string) => {
  if (!query.value) return title;
  const q = query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return title.replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
};

const open = async () => {
  isOpen.value = true;
  query.value = '';
  activeIdx.value = 0;
  await nextTick();
  inputRef.value?.focus();
};

const close = () => { isOpen.value = false; };

const moveDown = () => {
  activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1);
  scrollToActive();
};

const moveUp = () => {
  activeIdx.value = Math.max(activeIdx.value - 1, 0);
  scrollToActive();
};

const scrollToActive = () => {
  nextTick(() => {
    resultsRef.value?.querySelectorAll('.cp-item')[activeIdx.value]?.scrollIntoView({ block: 'nearest' });
  });
};

const runCmd = (cmd: Command) => {
  close();
  cmd.action();
};

const runActive = () => {
  const cmd = filtered.value[activeIdx.value];
  if (cmd) runCmd(cmd);
};

import { watch, onMounted, onUnmounted } from 'vue';
watch(query, () => { activeIdx.value = 0; });

// Горячие клавиши
const handleKeyDown = (e: KeyboardEvent) => {
  if (isOpen.value) return; // Если палитра открыта, не обрабатываем
  
  // Ctrl+P - открыть команды
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

defineExpose({ open, close });
</script>

<style scoped>
.cp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  z-index: 99999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
}

.cp-modal {
  width: 600px;
  max-width: 94vw;
  background: var(--bg-panel, #1a1a2e);
  border: 1px solid rgba(139,92,246,0.4);
  border-radius: 14px;
  box-shadow: 0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.15) inset;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cp-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

.cp-icon { color: rgba(139,92,246,0.8); font-size: 14px; flex-shrink: 0; }

.cp-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-main, #fff);
  font-size: 16px;
  font-family: var(--font-family, Inter, sans-serif);
}
.cp-input::placeholder { color: rgba(255,255,255,0.25); }

.cp-hint-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(139,92,246,0.12);
  border: 1px solid rgba(139,92,246,0.2);
  border-radius: 4px;
  color: rgba(139,92,246,0.6);
  flex-shrink: 0;
}

.cp-results {
  max-height: 380px;
  overflow-y: auto;
  padding: 6px;
}
.cp-results::-webkit-scrollbar { width: 4px; }
.cp-results::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }

.cp-empty {
  text-align: center;
  padding: 28px;
  color: rgba(255,255,255,0.25);
  font-size: 14px;
}

.cp-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s;
}

.cp-item:hover, .cp-item.active {
  background: rgba(139,92,246,0.14);
}

.cp-item-icon { font-size: 18px; flex-shrink: 0; width: 26px; text-align: center; }

.cp-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-item-title {
  font-size: 14px;
  color: var(--text-main, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.cp-item-title mark) {
  background: rgba(139,92,246,0.35);
  color: #c4b5fd;
  border-radius: 2px;
  padding: 0 1px;
}

.cp-item-desc {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
}

.cp-kbd {
  font-size: 10px;
  padding: 1px 5px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  color: rgba(255,255,255,0.25);
  flex-shrink: 0;
  white-space: nowrap;
}

.cp-enter-hint {
  font-size: 11px;
  padding: 1px 5px;
  background: rgba(139,92,246,0.2);
  border: 1px solid rgba(139,92,246,0.4);
  border-radius: 4px;
  color: #a78bfa;
  flex-shrink: 0;
}

.cp-footer {
  display: flex;
  gap: 20px;
  padding: 8px 18px;
  border-top: 1px solid rgba(255,255,255,0.04);
  font-size: 11px;
  color: rgba(255,255,255,0.2);
}

.cp-footer kbd {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 3px;
  padding: 0 4px;
  font-size: 10px;
  color: rgba(255,255,255,0.35);
}

.cp-fade-enter-active, .cp-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.cp-fade-enter-from, .cp-fade-leave-to { opacity: 0; transform: scale(0.97) translateY(-6px); }
</style>
