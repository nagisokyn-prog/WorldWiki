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

export function isCharacterEntity(entity?: Entity | null): boolean {
  if (!entity) return false;
  const rawType = String(entity.entity_type || '').trim().toLowerCase();
  return (
    rawType === 'character' ||
    rawType === 'characters' ||
    rawType === 'person' ||
    rawType.includes('персонаж') ||
    rawType.includes('герой')
  );
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
      if (!isCharacterEntity(e)) return false;
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
