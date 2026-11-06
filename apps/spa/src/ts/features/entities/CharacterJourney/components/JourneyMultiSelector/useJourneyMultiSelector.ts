import { computed } from 'vue';
import type { Entity } from '@/types/generated/Entity';

export interface UseJourneyMultiSelectorProps {
  selectedEntities: Entity[];
  entitiesList: Entity[];
}

export interface UseJourneyMultiSelectorEmit {
  (e: 'add', id: string): void;
  (e: 'remove', id: string): void;
}

export function useJourneyMultiSelector(
  props: UseJourneyMultiSelectorProps,
  emit: UseJourneyMultiSelectorEmit
) {
  const availableEntities = computed(() => {
    const selectedCleanIds = new Set(
      props.selectedEntities.map((e) => (e.id || '').replace(/^entities:/, ''))
    );
    return props.entitiesList.filter((e) => {
      const cleanId = (e.id || '').replace(/^entities:/, '');
      return !selectedCleanIds.has(cleanId);
    });
  });

  const handleAddChange = (evt: Event) => {
    const target = evt.target as HTMLSelectElement;
    if (target.value) {
      emit('add', target.value);
      target.value = '';
    }
  };

  const handleRemove = (id: string | null | undefined) => {
    if (id) {
      emit('remove', id);
    }
  };

  return {
    availableEntities,
    handleAddChange,
    handleRemove,
  };
}
