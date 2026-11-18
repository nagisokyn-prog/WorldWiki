import { computed } from 'vue';
import type { TimelineInspectorToolbarProps, TimelineInspectorToolbarEmits } from './TimelineInspectorToolbar.model';

export function useTimelineInspectorToolbar(
  props: TimelineInspectorToolbarProps,
  emit: TimelineInspectorToolbarEmits
) {
  const volumeWheelOptions = computed(() =>
    (props.volumeOptions || []).map((v) => ({ value: v.id, label: `📚 ${v.title}` }))
  );

  const linkModeOptions = [
    { value: 'focus', label: '🎯 Фокус (при наведении / клике)' },
    { value: 'all', label: '🕸️ Все связи (паутина)' },
    { value: 'none', label: '🚫 Без связей' },
  ];

  const isolatedChapterOptions = computed(() => [
    { value: '', label: 'Все сцены рукописи' },
    ...props.filteredChapters.map((ch) => ({
      value: ch.id,
      label: `${ch.title} (${ch.sceneCount || 0} сцен)`,
    })),
  ]);

  const horizonOptions = computed(() => [
    { value: '', label: '👑 Режим Автора (Все главы)' },
    ...props.filteredChapters.map((ch) => ({
      value: ch.sort_order,
      label: `📖 До: ${ch.title}`,
    })),
  ]);

  function onRefresh() {
    emit('refresh');
  }

  return {
    volumeWheelOptions,
    linkModeOptions,
    isolatedChapterOptions,
    horizonOptions,
    onRefresh,
  };
}

