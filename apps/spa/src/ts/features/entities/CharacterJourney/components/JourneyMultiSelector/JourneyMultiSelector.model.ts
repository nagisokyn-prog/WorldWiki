import type { Entity } from '@/types/generated/Entity'

export interface JourneyMultiSelectorProps {
  selectedEntities: Entity[];
    entitiesList: Entity[];
}

export type JourneyMultiSelectorEmits = {
  (e: 'add', id: string): void;
    (e: 'remove', id: string): void;
};
