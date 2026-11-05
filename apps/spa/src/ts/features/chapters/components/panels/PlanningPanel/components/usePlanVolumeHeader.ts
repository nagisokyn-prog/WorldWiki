import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { PlanVolumeHeaderProps, PlanVolumeHeaderEmits } from './PlanVolumeHeader.model';

export function usePlanVolumeHeader(props: PlanVolumeHeaderProps, emit: PlanVolumeHeaderEmits) {
  const isHelpOpen = ref(false);
  const isVolumeMenuOpen = ref(false);

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

  function toggleVolumeMenu() {
    isVolumeMenuOpen.value = !isVolumeMenuOpen.value;
  }

  function selectVolume(volumeId: string) {
    emit('select-volume', volumeId);
    isVolumeMenuOpen.value = false;
  }

  function onDocClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (target && !target.closest('.volume-select-container')) {
      isVolumeMenuOpen.value = false;
    }
  }

  onMounted(() => {
    document.addEventListener('click', onDocClick);
  });

  onUnmounted(() => {
    document.removeEventListener('click', onDocClick);
  });

  return {
    isHelpOpen,
    isVolumeMenuOpen,
    progressPct,
    handleToggle,
    toggleHelp,
    toggleVolumeMenu,
    selectVolume
  };
}

