import { ref, computed } from 'vue';
import type { PlanVolumeHeaderProps, PlanVolumeHeaderEmits } from './PlanVolumeHeader.model';

export function usePlanVolumeHeader(props: PlanVolumeHeaderProps, emit: PlanVolumeHeaderEmits) {
  const isHelpOpen = ref(false);

  const progressPct = computed(() => {
    if (!props.stats.total) return 0;
    return Math.round((props.stats.done / props.stats.total) * 100);
  });

  function handleToggle() {
    emit('toggle-collapse');
  }

  function toggleHelp() {
    isHelpOpen.value = !isHelpOpen.value;
  }

  return {
    isHelpOpen,
    progressPct,
    handleToggle,
    toggleHelp
  };
}

