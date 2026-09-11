import { ref, computed } from 'vue';

export interface ContextItem {
  id: string;
  title: string;
  type: string;
  [key: string]: unknown;
}

export interface EntityTypeOption {
  key: string;
  label: string;
}

export interface AiContextSelectorProps {
  selectedContext?: ContextItem[];
  currentProject?: string;
}

export interface AiContextSelectorEmits {
  (e: 'context-selected', contexts: ContextItem[]): void;
  (e: 'remove-context', context: ContextItem): void;
}

export function useAiContextSelector(
  _props: AiContextSelectorProps,
  emit: AiContextSelectorEmits
) {
  const isOpen = ref(false);
  const level = ref(0);
  const currentCategory = ref('');
  const currentEntityType = ref('');
  const searchQuery = ref('');
  const selectedContexts = ref<ContextItem[]>([]);

  const entityTypes: EntityTypeOption[] = [
    { key: 'character', label: 'Персонаж' },
    { key: 'location', label: 'Локация' },
    { key: 'organization', label: 'Организация' }
  ];

  const mockItems: ContextItem[] = [
    { id: '1', title: 'Гарри Поттер', type: 'character' },
    { id: '2', title: 'Хогвартс', type: 'location' },
    { id: '3', title: 'Том 1: Философский камень', type: 'volume' },
    { id: '4', title: 'Глава 1: Мальчик, который выжил', type: 'chapter' }
  ];

  const toggleMenu = () => {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
      level.value = 0;
      searchQuery.value = '';
      currentCategory.value = '';
    }
  };

  const goBack = () => {
    if (level.value > 0) {
      level.value--;
      searchQuery.value = '';
    }
  };

  const getMenuTitle = () => {
    if (level.value === 0) return 'Добавить контекст';
    if (level.value === 1) {
      if (currentCategory.value === 'volume') return 'Тома';
      if (currentCategory.value === 'chapter') return 'Главы';
      if (currentCategory.value === 'entity') return 'Типы сущностей';
    }
    if (level.value === 2) return 'Выберите сущности';
    return '';
  };

  const selectCategory = (cat: string) => {
    currentCategory.value = cat;
    level.value = 1;
  };

  const selectEntityType = (type: string) => {
    currentEntityType.value = type;
    level.value = 2;
  };

  const filteredEntityTypes = computed(() => {
    return entityTypes.filter(t => t.label.toLowerCase().includes(searchQuery.value.toLowerCase()));
  });

  const filteredItems = computed(() => {
    let items = mockItems.filter(i => {
      if (currentCategory.value === 'entity') {
        return i.type === currentEntityType.value;
      }
      return i.type === currentCategory.value;
    });

    if (searchQuery.value) {
      items = items.filter(i => i.title.toLowerCase().includes(searchQuery.value.toLowerCase()));
    }

    return items;
  });

  const isSelected = (item: ContextItem) => {
    return selectedContexts.value.some(i => i.id === item.id);
  };

  const toggleItem = (item: ContextItem) => {
    if (isSelected(item)) {
      selectedContexts.value = selectedContexts.value.filter(i => i.id !== item.id);
    } else {
      selectedContexts.value.push(item);
    }
  };

  const applySelection = () => {
    emit('context-selected', selectedContexts.value);
    selectedContexts.value = [];
    isOpen.value = false;
  };

  return {
    isOpen,
    level,
    currentCategory,
    searchQuery,
    selectedContexts,
    filteredEntityTypes,
    filteredItems,
    toggleMenu,
    goBack,
    getMenuTitle,
    selectCategory,
    selectEntityType,
    isSelected,
    toggleItem,
    applySelection
  };
}
