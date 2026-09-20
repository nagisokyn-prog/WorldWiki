import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { PersonaMode, AiModeSelectorProps, AiModeSelectorEmits } from './AiModeSelector.model';

export const DEFAULT_PERSONA_MODES: PersonaMode[] = [
  {
    slug: 'companion',
    name: 'Собеседник',
    icon: 'fas fa-theater-masks',
    description: 'Литературный соавтор, брейншторминг, диалоги, развитие идей (только чтение и поиск)',
    hotkey: 'Ctrl + .'
  },
  {
    slug: 'editor',
    name: 'Редактор',
    icon: 'fas fa-pen-fancy',
    description: 'Правки рукописи, создание и редактирование сущностей, ведение хронологии',
    hotkey: 'Ctrl + .'
  },
  {
    slug: 'analyst',
    name: 'Аналитик',
    icon: 'fas fa-search-plus',
    description: 'Поиск сюжетных дыр, аудит чеховских ружей, проверка непротиворечивости лора',
    hotkey: 'Ctrl + .'
  }
];

export function useAiModeSelector(
  props: AiModeSelectorProps,
  emit: AiModeSelectorEmits
) {
  const isOpen = ref(false);
  const containerRef = ref<HTMLElement | null>(null);

  const normalizeSlug = (slug?: string): string => {
    if (!slug) return 'companion';
    const s = slug.toLowerCase();
    if (s === 'edit' || s === 'editor' || s === 'редактор') return 'editor';
    if (s === 'analyze' || s === 'analyst' || s === 'аналитик') return 'analyst';
    return 'companion';
  };

  const personaModes = computed<PersonaMode[]>(() => {
    return DEFAULT_PERSONA_MODES;
  });

  const activeNormalizedSlug = computed(() => normalizeSlug(props.activeModeSlug));

  const currentMode = computed<PersonaMode>(() => {
    const target = personaModes.value.find(m => m.slug === activeNormalizedSlug.value);
    return target || personaModes.value[0];
  });

  const togglePopover = () => {
    if (props.disabled) return;
    isOpen.value = !isOpen.value;
  };

  const selectMode = (slug: string) => {
    emit('change-mode', slug);
    isOpen.value = false;
  };

  const cycleMode = () => {
    const modes = personaModes.value;
    const currentIndex = modes.findIndex(m => m.slug === activeNormalizedSlug.value);
    const nextIndex = (currentIndex + 1) % modes.length;
    selectMode(modes[nextIndex].slug);
  };

  const openSettings = () => {
    isOpen.value = false;
    emit('open-mode-settings');
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
      isOpen.value = false;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === '.') {
      e.preventDefault();
      cycleMode();
    } else if (e.key === 'Escape' && isOpen.value) {
      isOpen.value = false;
    }
  };

  onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('keydown', handleKeyDown);
  });

  return {
    isOpen,
    containerRef,
    personaModes,
    activeNormalizedSlug,
    currentMode,
    togglePopover,
    selectMode,
    cycleMode,
    openSettings
  };
}
