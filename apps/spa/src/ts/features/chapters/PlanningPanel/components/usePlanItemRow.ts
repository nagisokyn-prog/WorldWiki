import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { PlanItemRowProps, PlanItemRowEmits } from './PlanItemRow.model';
import type { TodoStatus, DependencyCandidate } from '../PlanningPanel.model';
import { getCleanId } from '../planningPanel.utils';

function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}`);
}

export function usePlanItemRow(props: PlanItemRowProps, emit: PlanItemRowEmits) {
  const isDepMenuOpen = ref(false);
  const isStatusMenuOpen = ref(false);

  const statusTooltip = computed(() => {
    const status: TodoStatus = props.item.status;
    let label = 'В планах';
    if (status === 'in_progress') label = 'В работе';
    else if (status === 'done' || props.item.done) label = 'Готово';
    else if (status === 'blocked') label = 'Ожидает';
    return `${label} (ЛКМ — следующий по кругу, ПКМ — выбрать статус)`;
  });

  const groupedCandidates = computed(() => {
    const currentCleanId = getCleanId(props.item.id);
    const available = (props.allTodos || []).filter(c => getCleanId(c.id) !== currentCleanId);

    const map = new Map<string, { chapterId: string; chapterTitle: string; todos: DependencyCandidate[] }>();
    for (const c of available) {
      const chKey = c.chapterId || 'unknown';
      if (!map.has(chKey)) {
        map.set(chKey, {
          chapterId: c.chapterId,
          chapterTitle: c.chapterTitle,
          todos: []
        });
      }
      map.get(chKey)!.todos.push(c);
    }
    return Array.from(map.values());
  });

  function toggleDepMenu() {
    isDepMenuOpen.value = !isDepMenuOpen.value;
    if (isDepMenuOpen.value) {
      isStatusMenuOpen.value = false;
    }
  }

  function closeDepMenu() {
    isDepMenuOpen.value = false;
  }

  function openStatusMenu(e?: MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    isStatusMenuOpen.value = true;
    isDepMenuOpen.value = false;
  }

  function closeStatusMenu() {
    isStatusMenuOpen.value = false;
  }

  function onSelectStatus(status: TodoStatus) {
    emit('set-status', props.item, status);
    emit('cycle-status', props.item, status);
    closeStatusMenu();
  }

  function onSelectDependency(parentId: string | null) {
    emit('set-dependency', props.item, parentId);
    closeDepMenu();
  }

  function handleDocumentClick() {
    if (isDepMenuOpen.value) {
      closeDepMenu();
    }
    if (isStatusMenuOpen.value) {
      closeStatusMenu();
    }
  }

  onMounted(() => {
    window.addEventListener('click', handleDocumentClick);
    window.addEventListener('contextmenu', handleDocumentClick);
  });

  onUnmounted(() => {
    window.removeEventListener('click', handleDocumentClick);
    window.removeEventListener('contextmenu', handleDocumentClick);
  });

  function onToggle() {
    emit('toggle', props.item);
  }

  function onCycleStatus() {
    openStatusMenu();
  }

  function onSave() {
    emit('save', props.item);
  }

  function onDelete() {
    emit('delete', props.item);
  }

  function onNavigate(chapterId: string) {
    emit('navigate', chapterId);
  }

  return {
    statusTooltip,
    isDepMenuOpen,
    isStatusMenuOpen,
    groupedCandidates,
    toggleDepMenu,
    closeDepMenu,
    openStatusMenu,
    closeStatusMenu,
    onSelectStatus,
    onSelectDependency,
    onToggle,
    onCycleStatus,
    onSave,
    onDelete,
    onNavigate
  };
}

