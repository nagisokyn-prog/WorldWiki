import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { PlanItemRowProps, PlanItemRowEmits } from './PlanItemRow.model';
import type { TodoStatus, DependencyCandidate } from '../PlanningPanel.model';
import { getCleanId } from '../planningPanel.utils';

function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}`);
}

export function usePlanItemRow(props: PlanItemRowProps, emit: PlanItemRowEmits) {
  const isDepMenuOpen = ref(false);

  const statusTooltip = computed(() => {
    const status: TodoStatus = props.item.status;
    switch (status) {
      case 'in_progress':
        return 'В работе 🟡 (клик — завершить, ПКМ — сменить статус)';
      case 'done':
        return 'Готово 🟢 (клик — вернуть в план)';
      case 'blocked':
        return 'Ожидает 🔒 (зависит от другой задачи, разблокируется автоматически)';
      case 'planned':
        return 'В планах ⚪ (клик — завершить, ПКМ — перевести в работу)';
      default:
        return assertNever(status);
    }
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
  }

  function closeDepMenu() {
    isDepMenuOpen.value = false;
  }

  function onSelectDependency(parentId: string | null) {
    emit('set-dependency', props.item, parentId);
    closeDepMenu();
  }

  function handleDocumentClick() {
    if (isDepMenuOpen.value) {
      closeDepMenu();
    }
  }

  onMounted(() => {
    window.addEventListener('click', handleDocumentClick);
  });

  onUnmounted(() => {
    window.removeEventListener('click', handleDocumentClick);
  });

  function onToggle() {
    emit('toggle', props.item);
  }

  function onCycleStatus() {
    emit('cycle-status', props.item);
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
    groupedCandidates,
    toggleDepMenu,
    closeDepMenu,
    onSelectDependency,
    onToggle,
    onCycleStatus,
    onSave,
    onDelete,
    onNavigate
  };
}

