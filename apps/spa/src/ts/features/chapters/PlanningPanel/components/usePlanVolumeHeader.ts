import { computed } from 'vue';
import type { PlanVolumeHeaderProps, PlanVolumeHeaderEmits } from './PlanVolumeHeader.model';

export function usePlanVolumeHeader(props: PlanVolumeHeaderProps, emit: PlanVolumeHeaderEmits) {
  const progressPct = computed(() => {
    if (!props.stats.total) return 0;
    return Math.round((props.stats.done / props.stats.total) * 100);
  });

  function handleToggle() {
    emit('toggle-collapse');
  }

  return {
    progressPct,
    handleToggle
  };
}
