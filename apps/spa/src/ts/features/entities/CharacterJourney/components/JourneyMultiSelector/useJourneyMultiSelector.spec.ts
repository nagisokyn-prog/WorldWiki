import { describe, it, expect, vi } from 'vitest';
import { useJourneyMultiSelector } from './useJourneyMultiSelector';
import type { Entity } from '@/types/generated/Entity';

describe('useJourneyMultiSelector Composable', () => {
  const entity1: Entity = { id: 'entities:1', name: 'Раскольников', entity_type: 'character', project_id: 'p1', attributes: {}, tags: [] };
  const entity2: Entity = { id: 'entities:2', name: 'Сонечка', entity_type: 'character', project_id: 'p1', attributes: {}, tags: [] };
  const entity3: Entity = { id: 'entities:3', name: 'Свидригайлов', entity_type: 'character', project_id: 'p1', attributes: {}, tags: [] };
  const locationEntity: Entity = { id: 'entities:loc1', name: 'Дом белых', entity_type: 'location', project_id: 'p1', attributes: {}, tags: [] };
  const stateEntity: Entity = { id: 'entities:state1', name: 'ФР', entity_type: 'state', project_id: 'p1', attributes: {}, tags: [] };

  it('filters out already selected entities and non-character entities from availableEntities', () => {
    const emit = vi.fn();
    const { availableEntities } = useJourneyMultiSelector(
      {
        selectedEntities: [entity1],
        entitiesList: [entity1, entity2, entity3, locationEntity, stateEntity],
      },
      emit
    );

    expect(availableEntities.value).toHaveLength(2);
    expect(availableEntities.value.map((e) => e.name)).toEqual(['Сонечка', 'Свидригайлов']);
  });

  it('emits add event when handleAddChange is called with a select value', () => {
    const emit = vi.fn();
    const { handleAddChange } = useJourneyMultiSelector(
      {
        selectedEntities: [entity1],
        entitiesList: [entity1, entity2],
      },
      emit
    );

    const mockEvent = {
      target: {
        value: 'entities:2',
      },
    } as unknown as Event;

    handleAddChange(mockEvent);
    expect(emit).toHaveBeenCalledWith('add', 'entities:2');
    expect((mockEvent.target as HTMLSelectElement).value).toBe('');
  });

  it('emits remove event when handleRemove is called with a valid id', () => {
    const emit = vi.fn();
    const { handleRemove } = useJourneyMultiSelector(
      {
        selectedEntities: [entity1, entity2],
        entitiesList: [entity1, entity2],
      },
      emit
    );

    handleRemove('entities:1');
    expect(emit).toHaveBeenCalledWith('remove', 'entities:1');

    handleRemove(null);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
