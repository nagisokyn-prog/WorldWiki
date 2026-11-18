import { computed } from 'vue';
import type { JourneyToolbarProps, JourneyToolbarEmits } from './JourneyToolbar.model';
import type { JourneyFilterMode } from '../../CharacterJourney.model';

export function useJourneyToolbar(emit: JourneyToolbarEmits, props?: JourneyToolbarProps) {
  const arcWheelOptions = computed(() => [
    { value: 'ALL', label: 'Все (с арками и без)' },
    { value: 'ALL_ARCS', label: 'Все сюжетные арки' },
    { value: 'UNASSIGNED', label: 'Вне сюжетных арок' },
    ...(props?.storyArcs || []).map((arc) => ({ value: arc.id || '', label: arc.title })),
  ]);

  const categoryWheelOptions = [
    { value: 'all', label: 'Все элементы' },
    { value: 'scenes', label: 'Сцены и главы' },
    { value: 'promises', label: 'Сюжетные ружья' },
    { value: 'events', label: 'События мира' },
    { value: 'relations', label: 'Отношения' },
  ];

  const onFilterModeUpdate = (val: JourneyFilterMode) => {
    emit('update:filterMode', val);
    emit('update:filter-mode', val);
  };

  return {
    arcWheelOptions,
    categoryWheelOptions,
    onFilterModeUpdate
  };
}

