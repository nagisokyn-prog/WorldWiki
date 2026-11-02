import { computed } from 'vue';
import type { PlanItemRowProps, PlanItemRowEmits } from './PlanItemRow.model';
import type { TodoStatus } from '../PlanningPanel.model';

function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${x}`);
}

export function usePlanItemRow(props: PlanItemRowProps, emit: PlanItemRowEmits) {
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
    onToggle,
    onCycleStatus,
    onSave,
    onDelete,
    onNavigate
  };
}

