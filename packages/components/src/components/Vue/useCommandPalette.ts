import { ref, computed, watch, nextTick } from 'vue';

export interface PaletteCommand {
  id: string;
  title: string;
  desc: string;
  icon: string;
  hotkey?: string;
  keywords?: string[];
  action: () => void;
}

export interface CommandPaletteProps {
  commands?: PaletteCommand[];
  disableBuiltins?: boolean;
}

export interface CommandPaletteEmits {
  (e: 'save'): void;
  (e: 'save-all'): void;
  (e: 'new-entity'): void;
  (e: 'new-chapter'): void;
  (e: 'open-tags'): void;
  (e: 'open-sandbox'): void;
  (e: 'open-settings'): void;
  (e: 'toggle-sidebar'): void;
  (e: 'toggle-panel'): void;
  (e: 'close-all-tabs'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'zoom-reset'): void;
  (e: 'open-quick'): void;
}

export function useCommandPalette(
  props: CommandPaletteProps,
  emit: CommandPaletteEmits
) {
  const isOpen = ref(false);
  const query = ref('');
  const activeIdx = ref(0);
  const inputRef = ref<HTMLInputElement | null>(null);
  const resultsRef = ref<HTMLElement | null>(null);

  const close = () => {
    isOpen.value = false;
  };

  const builtinCommands = computed<PaletteCommand[]>(() => [
    {
      id: 'save-all',
      title: 'Сохранить всё',
      desc: 'Сохранить все несохраненные вкладки',
      icon: '💾',
      hotkey: 'Ctrl+S',
      keywords: ['сохранить', 'save', 'все', 'вкладки', 'write'],
      action: () => { close(); emit('save-all'); }
    },
    {
      id: 'new-chapter',
      title: 'Новая глава',
      desc: 'Создать новую главу рукописи',
      icon: '📝',
      hotkey: 'Ctrl+Shift+N',
      keywords: ['новая', 'глава', 'рукопись', 'chapter', 'new'],
      action: () => { close(); emit('new-chapter'); }
    },
    {
      id: 'new-entity',
      title: 'Создать сущность',
      desc: 'Создать новую запись в энциклопедии лора',
      icon: '✨',
      hotkey: 'Ctrl+N',
      keywords: ['создать', 'сущность', 'персонаж', 'локация', 'лор', 'entity', 'new'],
      action: () => { close(); emit('new-entity'); }
    },
    {
      id: 'open-tags',
      title: 'Теги проекта',
      desc: 'Управление тегами и метками произведения',
      icon: '🏷️',
      hotkey: 'Ctrl+Shift+T',
      keywords: ['теги', 'метки', 'tags'],
      action: () => { close(); emit('open-tags'); }
    },
    {
      id: 'quick-open',
      title: 'Быстрый переход',
      desc: 'Найти и открыть любой элемент проекта',
      icon: '🔎',
      hotkey: 'Ctrl+P',
      keywords: ['переход', 'поиск', 'открыть', 'quick', 'open', 'find'],
      action: () => { close(); emit('open-quick'); }
    },
    {
      id: 'open-settings',
      title: 'Настройки приложения',
      desc: 'Темы оформления, шрифты, параметры',
      icon: '⚙️',
      hotkey: 'Ctrl+,',
      keywords: ['настройки', 'параметры', 'тема', 'шрифт', 'settings', 'preferences'],
      action: () => { close(); emit('open-settings'); }
    },
    {
      id: 'toggle-sidebar',
      title: 'Показать / скрыть боковую панель',
      desc: 'Дерево проекта и навигация',
      icon: '🗂️',
      hotkey: 'Ctrl+B',
      keywords: ['боковая', 'панель', 'сайдбар', 'проводник', 'sidebar'],
      action: () => { close(); emit('toggle-sidebar'); }
    },
    {
      id: 'toggle-panel',
      title: 'Показать / скрыть терминал',
      desc: 'Нижняя консоль, логи и инструменты',
      icon: '💻',
      hotkey: 'Ctrl+`',
      keywords: ['терминал', 'консоль', 'лог', 'панель', 'terminal', 'console'],
      action: () => { close(); emit('toggle-panel'); }
    },
    {
      id: 'close-all-tabs',
      title: 'Закрыть все вкладки',
      desc: 'Закрыть все открытые редакторы',
      icon: '✖️',
      keywords: ['закрыть', 'все', 'вкладки', 'редакторы', 'close'],
      action: () => { close(); emit('close-all-tabs'); }
    },
    {
      id: 'zoom-in',
      title: 'Масштаб: Увеличить',
      desc: 'Увеличить масштаб интерфейса',
      icon: '🔍',
      hotkey: 'Ctrl+=',
      keywords: ['масштаб', 'увеличить', 'крупнее', 'zoom', 'in'],
      action: () => { close(); emit('zoom-in'); }
    },
    {
      id: 'zoom-out',
      title: 'Масштаб: Уменьшить',
      desc: 'Уменьшить масштаб интерфейса',
      icon: '🔎',
      hotkey: 'Ctrl+-',
      keywords: ['масштаб', 'уменьшить', 'мельче', 'zoom', 'out'],
      action: () => { close(); emit('zoom-out'); }
    },
    {
      id: 'zoom-reset',
      title: 'Масштаб: 100%',
      desc: 'Сбросить масштаб интерфейса к стандартному',
      icon: '⊙',
      hotkey: 'Ctrl+0',
      keywords: ['масштаб', 'сброс', '100%', 'стандартный', 'zoom', 'reset'],
      action: () => { close(); emit('zoom-reset'); }
    }
  ]);

  const allCommands = computed<PaletteCommand[]>(() => [
    ...(props.disableBuiltins ? [] : builtinCommands.value),
    ...(props.commands ?? [])
  ]);

  const filtered = computed(() => {
    if (!query.value.trim()) return allCommands.value;
    const q = query.value.toLowerCase();
    return allCommands.value.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      (c.keywords || []).some(k => k.toLowerCase().includes(q))
    );
  });

  const open = async () => {
    isOpen.value = true;
    query.value = '';
    activeIdx.value = 0;
    await nextTick();
    inputRef.value?.focus();
  };

  const scrollToActive = () => {
    void nextTick(() => {
      resultsRef.value?.querySelectorAll('.cp-item')[activeIdx.value]?.scrollIntoView({ block: 'nearest' });
    });
  };

  const moveDown = () => {
    if (filtered.value.length === 0) return;
    activeIdx.value = (activeIdx.value + 1) % filtered.value.length;
    scrollToActive();
  };

  const moveUp = () => {
    if (filtered.value.length === 0) return;
    activeIdx.value = (activeIdx.value - 1 + filtered.value.length) % filtered.value.length;
    scrollToActive();
  };

  const runCmd = (cmd: PaletteCommand) => {
    close();
    cmd.action();
  };

  const runActive = () => {
    const cmd = filtered.value[activeIdx.value];
    if (cmd) runCmd(cmd);
  };

  watch(query, () => {
    activeIdx.value = 0;
  });

  return {
    isOpen,
    query,
    activeIdx,
    inputRef,
    resultsRef,
    filtered,
    open,
    close,
    moveDown,
    moveUp,
    runCmd,
    runActive
  };
}
