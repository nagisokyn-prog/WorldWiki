import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { PlotPromise } from '@/types/generated/PlotPromise';
import type { RichPlotPromise } from '@/features/chapters/PromisesPanel/usePromisesPanel';

export interface PromiseTypeOption {
  kind: string;
  label: string;
  icon: string;
  description: string;
}

export const promiseTypes: PromiseTypeOption[] = [
  {
    kind: 'scene',
    label: 'Сцена / Эпизод',
    icon: '🎬',
    description: 'Нарративная сцена с участниками, локацией и таймлайном'
  },
  {
    kind: 'conflict',
    label: 'Конфликт',
    icon: '⚔️',
    description: 'Столкновение сторон, мотивов или сил с фазами развития'
  },
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

export interface PromiseContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  existingPromises?: (PlotPromise | RichPlotPromise)[];
}

export interface PromiseContextMenuEmits {
  (e: 'close'): void;
  (e: 'select', item: PromiseTypeOption): void;
  (e: 'link-milestone', payload: { promise: PlotPromise | RichPlotPromise; stage: 'progression' | 'resolution' }): void;
}

export function usePromiseContextMenu(
  props: PromiseContextMenuProps,
  emit: PromiseContextMenuEmits
) {
  const menuRef = ref<HTMLElement | null>(null);
  const selectedIndex = ref(0);
  const currentTab = ref<'create' | 'link'>('create');
  const adjustedPos = ref({ x: 0, y: 0 });

  const activeExistingPromises = computed(() => {
    return (props.existingPromises || [])
      .filter((p) => p.status !== 'resolved')
      .map((p) => {
        const type = promiseTypes.find((t) => t.kind === p.kind);
        const rich = p as RichPlotPromise;
        const quote = rich.quote || (p.milestones && p.milestones[0]?.quote) || p.title || '';
        return {
          ...p,
          quote,
          kindIcon: type?.icon || '📌',
          kindLabel: type?.label || 'Обещание',
        };
      });
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

  const selectMilestone = (promise: PlotPromise | RichPlotPromise, stage: 'progression' | 'resolution') => {
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
      void nextTick(() => {
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

  return {
    menuRef,
    selectedIndex,
    currentTab,
    adjustedPos,
    promiseTypes,
    activeExistingPromises,
    getKindIcon,
    getKindLabel,
    selectItem,
    selectMilestone
  };
}
